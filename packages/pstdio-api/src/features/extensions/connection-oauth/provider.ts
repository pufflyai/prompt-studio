import { extractWWWAuthenticateParams } from "@modelcontextprotocol/sdk/client/auth.js";
import type { DeclaredExtensionConnection } from "pstdio-api-contracts/extension-kernel";
import { z } from "zod";
import { ConnectionInputError, readBoundedBody, validateBaseUrl } from "../extension-connection-transport";

const scopeSchema = z.array(z.string().regex(/^[\x21\x23-\x5B\x5D-\x7E]+$/));
const restSchema = z.object({
  type: z.literal("oauth"),
  baseUrl: z.url(),
  authorizationEndpoint: z.url(),
  issuer: z.url().optional(),
  tokenEndpoint: z.url(),
  revocationEndpoint: z.url().optional(),
  clientId: z.string().min(1),
  scopes: scopeSchema.default([]),
});
const mcpSchema = z.object({
  type: z.literal("oauth"),
  resourceUrl: z.url(),
  authorizationServerOrigin: z.url().optional(),
  scopes: scopeSchema.default([]),
});
const protectedResourceSchema = z.object({
  resource: z.url(),
  authorization_servers: z.array(z.url()).min(1),
});
const authorizationServerSchema = z.object({
  issuer: z.url(),
  authorization_endpoint: z.url(),
  token_endpoint: z.url(),
  revocation_endpoint: z.url().optional(),
  registration_endpoint: z.url(),
  code_challenge_methods_supported: z.array(z.string()),
  token_endpoint_auth_methods_supported: z.array(z.string()).default(["client_secret_basic"]),
  revocation_endpoint_auth_methods_supported: z.array(z.string()).optional(),
});
const registrationSchema = z.object({
  client_id: z.string().min(1),
  client_secret: z.string().min(1).optional(),
  token_endpoint_auth_method: z.enum(["none", "client_secret_post", "client_secret_basic"]).optional(),
});
const tokenSchema = z.object({
  access_token: z.string().regex(/^[A-Za-z0-9._~+/-]+=*$/),
  refresh_token: z.string().min(1).optional(),
  token_type: z.string().refine((value) => value.toLowerCase() === "bearer"),
  expires_in: z.coerce.number().finite().min(0).max(315_576_000).optional(),
  scope: z.string().optional(),
});

export const oauthTarget = (contribution: DeclaredExtensionConnection) => {
  if ((contribution.scope ?? "project") !== "project" || contribution.auth.type !== "oauth")
    throw new ConnectionInputError("This connection does not declare project OAuth.");
  const config =
    contribution.transport === "mcp" ? mcpSchema.safeParse(contribution.auth) : restSchema.safeParse(contribution.auth);
  if (!config.success) throw new ConnectionInputError("The connection declares invalid OAuth settings.");
  const auth = config.data;
  const endpoint = oauthUrl("resourceUrl" in auth ? auth.resourceUrl : auth.baseUrl);
  return { auth, endpoint, binding: new Bun.CryptoHasher("sha256").update(JSON.stringify(auth)).digest("hex") };
};
export type OAuthTarget = ReturnType<typeof oauthTarget>;

export const oauthUrl = (value: string, relativeTo?: URL) => {
  try {
    const url = new URL(validateBaseUrl(value));
    if (new URL(value).hash || (relativeTo?.protocol === "https:" && url.protocol !== "https:")) throw new Error();
    url.search = new URL(value).search;
    return url;
  } catch {
    throw new ConnectionInputError("OAuth requires a valid HTTPS endpoint or a loopback HTTP endpoint.");
  }
};

type ClientAuth = "none" | "client_secret_post" | "client_secret_basic";
export interface OAuthClient {
  clientId: string;
  clientSecret?: string;
  method: ClientAuth;
}
export interface OAuthProvider {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  revocationEndpoint?: string;
  revocationMethod: ClientAuth;
  resource?: string;
  client: OAuthClient;
}
export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string | null;
  scopes: string[];
}

const providerRequest = async (fetchFn: typeof fetch, endpoint: URL | string, init?: RequestInit) => {
  try {
    return await fetchFn(endpoint, { ...init, redirect: "error", signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new ConnectionInputError("The OAuth provider could not be reached.");
  }
};

const providerJson = async (response: Response) => {
  try {
    return JSON.parse(new TextDecoder().decode(await readBoundedBody(response.body))) as unknown;
  } catch {
    return null;
  }
};

const metadataUrl = (base: URL, kind: string) =>
  new URL(`/.well-known/${kind}${base.pathname.replace(/\/$/, "")}`, base.origin);

const readResourceMetadata = async (fetchFn: typeof fetch, endpoint: URL) => {
  const challenge = await providerRequest(fetchFn, endpoint, {
    headers: { accept: "application/json, text/event-stream" },
  });
  const { resourceMetadataUrl } = extractWWWAuthenticateParams(challenge);
  await challenge.body?.cancel();
  if (resourceMetadataUrl && resourceMetadataUrl.origin !== endpoint.origin)
    throw new ConnectionInputError("The MCP server supplied OAuth metadata on a different origin.");
  const metadata = await providerRequest(
    fetchFn,
    resourceMetadataUrl
      ? oauthUrl(resourceMetadataUrl.href, endpoint)
      : metadataUrl(endpoint, "oauth-protected-resource"),
  );
  const fallback = metadata.status === 404 && !resourceMetadataUrl && endpoint.pathname !== "/";
  const body = await providerJson(metadata);
  if (!fallback) return protectedResourceSchema.safeParse(metadata.ok ? body : null);
  const rootMetadata = await providerRequest(fetchFn, new URL("/.well-known/oauth-protected-resource", endpoint));
  return protectedResourceSchema.safeParse(rootMetadata.ok ? await providerJson(rootMetadata) : null);
};

const requireOrigin = (value: string, base: URL, origin: string) => {
  const url = oauthUrl(value, base);
  if (url.origin !== origin)
    throw new ConnectionInputError("The MCP OAuth endpoint is outside the declared trusted origin.");
  return url;
};

const selectClientAuth = (methods: readonly string[]): ClientAuth => {
  if (methods.includes("client_secret_post")) return "client_secret_post";
  if (methods.includes("client_secret_basic")) return "client_secret_basic";
  if (methods.includes("none")) return "none";
  throw new ConnectionInputError("The OAuth provider does not accept a supported client authentication method.");
};

const readIssuer = async (
  fetchFn: typeof fetch,
  endpoint: URL,
  advertisedIssuers: readonly string[],
  configuredOrigin?: string,
) => {
  const trusted = configuredOrigin && oauthUrl(configuredOrigin, endpoint);
  if (trusted && (trusted.pathname !== "/" || trusted.search))
    throw new ConnectionInputError("Declare the authorization server's origin without a path or query.");
  const trustedOrigin = trusted ? trusted.origin : endpoint.origin;
  const trustedIssuers = advertisedIssuers.filter((issuer) => new URL(issuer).origin === trustedOrigin);
  if (!trustedIssuers.length)
    throw new ConnectionInputError("The MCP authorization server is outside the declared trusted origin.");
  const issuer = requireOrigin(trustedIssuers[0]!, endpoint, trustedOrigin);
  if (issuer.search) throw new ConnectionInputError("The MCP server supplied an invalid OAuth issuer.");
  let metadata = await providerRequest(fetchFn, metadataUrl(issuer, "oauth-authorization-server"));
  if (metadata.status === 404) {
    await metadata.body?.cancel();
    const openIdConfiguration = new URL(issuer);
    openIdConfiguration.pathname = `${issuer.pathname.replace(/\/$/, "")}/.well-known/openid-configuration`;
    metadata = await providerRequest(fetchFn, openIdConfiguration);
  }
  const document = authorizationServerSchema.safeParse(metadata.ok ? await providerJson(metadata) : null);
  if (
    !document.success ||
    oauthUrl(document.data.issuer).href !== issuer.href ||
    !document.data.code_challenge_methods_supported.includes("S256")
  )
    throw new ConnectionInputError(
      "The MCP authorization server did not advertise matching OAuth metadata and PKCE S256.",
    );
  return { issuer, trustedOrigin, info: document.data };
};

export const discoverProvider = async (fetchFn: typeof fetch, target: OAuthTarget, redirectUri: string) => {
  const { auth, endpoint } = target;
  if ("baseUrl" in auth) {
    const authorizationEndpoint = oauthUrl(auth.authorizationEndpoint, endpoint);
    const issuer = auth.issuer ? oauthUrl(auth.issuer, authorizationEndpoint) : new URL(authorizationEndpoint.origin);
    if (issuer.search) throw new ConnectionInputError("The connection declares an invalid OAuth issuer.");
    return {
      issuer: issuer.href,
      authorizationEndpoint: authorizationEndpoint.href,
      tokenEndpoint: oauthUrl(auth.tokenEndpoint, endpoint).href,
      revocationEndpoint: auth.revocationEndpoint && oauthUrl(auth.revocationEndpoint, endpoint).href,
      revocationMethod: "none",
      client: { clientId: auth.clientId, method: "none" },
    } satisfies OAuthProvider;
  }
  const advertised = await readResourceMetadata(fetchFn, endpoint);
  if (!advertised.success || oauthUrl(advertised.data.resource).href !== endpoint.href)
    throw new ConnectionInputError("The MCP server did not publish matching OAuth resource metadata.");
  const { issuer, trustedOrigin, info } = await readIssuer(
    fetchFn,
    endpoint,
    advertised.data.authorization_servers,
    auth.authorizationServerOrigin,
  );
  const authorizationEndpoint = requireOrigin(info.authorization_endpoint, issuer, trustedOrigin).href;
  const tokenEndpoint = requireOrigin(info.token_endpoint, issuer, trustedOrigin).href;
  const revocationEndpoint =
    info.revocation_endpoint && requireOrigin(info.revocation_endpoint, issuer, trustedOrigin).href;
  const method = selectClientAuth(info.token_endpoint_auth_methods_supported);
  const registration = await providerRequest(
    fetchFn,
    requireOrigin(info.registration_endpoint, issuer, trustedOrigin),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_name: "Prompt Studio",
        redirect_uris: [redirectUri],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: method,
      }),
    },
  );
  const client = registrationSchema.safeParse(registration.ok ? await providerJson(registration) : null);
  if (
    !client.success ||
    (client.data.token_endpoint_auth_method ?? method) !== method ||
    (method !== "none" && !client.data.client_secret)
  )
    throw new ConnectionInputError("The MCP authorization server did not register an OAuth client.");
  const revocationMethods = info.revocation_endpoint_auth_methods_supported ?? [method];
  const supportedRevocationMethods = revocationMethods.filter(
    (candidate) =>
      candidate === "none" ||
      Boolean(client.data.client_secret && ["client_secret_basic", "client_secret_post"].includes(candidate)),
  );
  const revocationMethod = supportedRevocationMethods.length ? selectClientAuth(supportedRevocationMethods) : "none";
  return {
    issuer: issuer.href,
    resource: endpoint.href,
    authorizationEndpoint,
    tokenEndpoint,
    revocationEndpoint: supportedRevocationMethods.length ? revocationEndpoint : undefined,
    revocationMethod,
    client: { clientId: client.data.client_id, clientSecret: client.data.client_secret, method },
  } satisfies OAuthProvider;
};

const formRequest = (provider: OAuthProvider, form: URLSearchParams, method = provider.client.method) => {
  const headers = new Headers({ "content-type": "application/x-www-form-urlencoded", accept: "application/json" });
  const { clientId, clientSecret } = provider.client;
  if (method === "client_secret_basic") {
    const encode = (value: string) => new URLSearchParams({ value }).toString().slice("value=".length);
    headers.set(
      "authorization",
      `Basic ${Buffer.from(`${encode(clientId)}:${encode(clientSecret!)}`).toString("base64")}`,
    );
  } else {
    form.set("client_id", clientId);
    if (method === "client_secret_post") form.set("client_secret", clientSecret!);
  }
  return { method: "POST", headers, body: form };
};

export const exchangeTokens = async (
  fetchFn: typeof fetch,
  provider: OAuthProvider,
  form: URLSearchParams,
  fallbackScopes: string[],
  now: () => number,
) => {
  if (provider.resource) form.set("resource", provider.resource);
  const response = await providerRequest(fetchFn, provider.tokenEndpoint, formRequest(provider, form));
  const body = await providerJson(response);
  const rejected = z.object({ error: z.enum(["invalid_grant", "invalid_client", "unauthorized_client"]) });
  if ((response.status === 400 || response.status === 401) && rejected.safeParse(body).success) return null;
  const parsed = tokenSchema.safeParse(response.ok ? body : null);
  if (!parsed.success) throw new ConnectionInputError("The OAuth provider did not return a usable token.");
  const token = parsed.data;
  const secrets = [
    token.access_token,
    token.refresh_token,
    provider.client.clientSecret,
    form.get("refresh_token"),
    form.get("code"),
    form.get("code_verifier"),
  ];
  const scopes = scopeSchema.safeParse(
    token.scope === undefined ? fallbackScopes : token.scope.split(/ +/).filter(Boolean),
  );
  if (!scopes.success || scopes.data.some((scope) => secrets.some((secret) => secret && scope.includes(secret))))
    throw new ConnectionInputError("The OAuth provider returned invalid scopes.");
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: token.expires_in === undefined ? null : new Date(now() + token.expires_in * 1000).toISOString(),
    scopes: scopes.data,
  } satisfies OAuthTokens;
};

export const revokeTokens = async (fetchFn: typeof fetch, provider: OAuthProvider, tokens: OAuthTokens) => {
  if (!provider.revocationEndpoint) return;
  const token = tokens.refreshToken ?? tokens.accessToken;
  const form = new URLSearchParams({ token, token_type_hint: tokens.refreshToken ? "refresh_token" : "access_token" });
  const response = await providerRequest(
    fetchFn,
    provider.revocationEndpoint,
    formRequest(provider, form, provider.revocationMethod),
  );
  await response.body?.cancel();
  if (!response.ok)
    throw new ConnectionInputError("The connection was disconnected locally. The provider did not confirm revocation.");
};
