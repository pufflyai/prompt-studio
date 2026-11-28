import { createHash, randomBytes } from "node:crypto";
import type { ConnectionKey } from "../extension-connection-service-types";
import { ConnectionInputError } from "../extension-connection-transport";
import type { OAuthGrantScope } from "./grants";
import {
  discoverProvider,
  exchangeTokens,
  type OAuthProvider,
  type OAuthTarget,
  type OAuthTokens,
  revokeTokens,
} from "./provider";

export const OAUTH_CALLBACK_PATH = "/v1/extension-connections/oauth/callback";
const FLOW_TTL_MS = 10 * 60_000;
const MAX_PENDING_FLOWS = 256;
const random = () => randomBytes(32).toString("base64url");

interface Pending {
  key: OAuthGrantScope["key"];
  input: ConnectionKey;
  slot: string;
  state: string;
  owner: string;
  target: OAuthTarget;
  verifier: string;
  redirectUri: string;
  expiresAt: number;
  provider?: OAuthProvider;
}

export const createOAuthConsent = (deps: {
  now: () => number;
  fetchFn: typeof fetch;
  resolve: (input: ConnectionKey, expected?: string) => Promise<OAuthGrantScope>;
  assertCurrent: (input: ConnectionKey, principal: string, binding: string) => Promise<void>;
  save: (flow: Pending, provider: OAuthProvider, tokens: OAuthTokens, assertFlow: () => Promise<void>) => Promise<void>;
}) => {
  const { now, fetchFn, resolve, assertCurrent, save } = deps;
  const pending = new Map<string, Pending>();
  const states = new Map<string, Pending>();
  const removePending = (flow: Pending) => {
    pending.delete(flow.slot);
    states.delete(flow.state);
  };

  const expire = () => {
    for (const flow of pending.values()) if (flow.expiresAt <= now()) removePending(flow);
  };

  const assertFlow = async (flow: Pending) => {
    await assertCurrent(flow.input, flow.owner, flow.target.binding);
    if (pending.get(flow.slot) !== flow || flow.expiresAt <= now())
      throw new ConnectionInputError("This authorization request has expired or was cancelled.");
  };

  const start = async (input: ConnectionKey, redirectUri: string, expected?: string) => {
    const { principal, key, slot, target } = await resolve(input, expected);
    await assertCurrent(input, principal, target.binding);
    expire();
    const previous = pending.get(slot);
    if (previous) removePending(previous);
    if (pending.size >= MAX_PENDING_FLOWS) throw new ConnectionInputError("Too many pending OAuth requests.");
    const flow = {
      key,
      input,
      slot,
      target,
      redirectUri,
      owner: principal,
      state: random(),
      verifier: random(),
      expiresAt: now() + FLOW_TTL_MS,
    } satisfies Pending;
    pending.set(slot, flow);
    try {
      const provider = await discoverProvider(fetchFn, target, redirectUri);
      await assertFlow(flow);
      const params = new URL(provider.authorizationEndpoint);
      for (const [name, value] of Object.entries({
        client_id: provider.client.clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        state: flow.state,
        code_challenge: createHash("sha256").update(flow.verifier).digest("base64url"),
        code_challenge_method: "S256",
        ...(target.auth.scopes.length && { scope: target.auth.scopes.join(" ") }),
        ...(provider.resource && { resource: provider.resource }),
      }))
        params.searchParams.set(name, value);
      const ready: Pending = { ...flow, provider };
      pending.set(slot, ready);
      states.set(flow.state, ready);
      return { authorizationUrl: params.href };
    } catch (error) {
      if (pending.get(slot) === flow) removePending(flow);
      throw error;
    }
  };

  const accept = async (callback: {
    state: string;
    redirectUri: string;
    code?: string;
    error?: string;
    issuer?: string;
  }) => {
    expire();
    const flow = states.get(callback.state);
    if (!flow?.provider || flow.redirectUri !== callback.redirectUri)
      throw new ConnectionInputError("This authorization request is invalid or expired.");
    await assertFlow(flow);
    const provider = flow.provider;
    if (states.get(callback.state) !== flow)
      throw new ConnectionInputError("This authorization request was already used.");
    states.delete(flow.state);
    try {
      if (!callback.code || callback.error) throw new ConnectionInputError("The provider did not grant access.");
      if (callback.issuer && new URL(callback.issuer).href !== new URL(provider.issuer).href)
        throw new ConnectionInputError("The OAuth callback issuer did not match.");
      const tokens = await exchangeTokens(
        fetchFn,
        provider,
        new URLSearchParams({
          grant_type: "authorization_code",
          code: callback.code,
          redirect_uri: flow.redirectUri,
          code_verifier: flow.verifier,
        }),
        flow.target.auth.scopes,
        now,
      );
      if (!tokens) throw new ConnectionInputError("The provider rejected the authorization code.");
      try {
        await save(flow, provider, tokens, () => assertFlow(flow));
      } catch (error) {
        await revokeTokens(fetchFn, provider, tokens).catch(() => undefined);
        throw error;
      }
    } finally {
      if (pending.get(flow.slot) === flow) removePending(flow);
    }
  };

  const cancelForProject = (projectId: string, extensionId?: string) => {
    for (const flow of pending.values())
      if (flow.key.projectId === projectId && (!extensionId || flow.key.extensionId === extensionId))
        removePending(flow);
  };

  const cancel = (slot: string) => {
    const flow = pending.get(slot);
    if (flow) removePending(flow);
  };
  const isAuthorizing = (slot: string) => {
    expire();
    return pending.has(slot);
  };

  return { start, accept, cancel, cancelForProject, isAuthorizing };
};
