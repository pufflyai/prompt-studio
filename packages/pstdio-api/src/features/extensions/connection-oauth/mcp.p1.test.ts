import { expect, test } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { McpExtensionConnection } from "pstdio-api-contracts/extension-kernel";
import { createDb, createExtensionConnectionsDBService, createProjectsDBService } from "pstdio-db";
import { z } from "zod";
import { createMemoryConnectionSecretStore } from "../connection-secret-store";
import { createExtensionConnectionService, createExtensionConnectionsApi } from "../extension-connection-service";

test("MCP OAuth discovers the issuer, registers a client, and scopes named tools to the owner", async () => {
  const directory = new McpServer({ name: "Fixture CRM", version: "1.0.0" });
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: () => crypto.randomUUID() });
  let toolReads = 0;
  directory.registerTool("read_accounts", { inputSchema: { cursor: z.string().optional() } }, ({ cursor }) => {
    toolReads++;
    return { content: [{ type: "text", text: cursor === "page-2" ? "Globex" : "Acme" }] };
  });
  directory.registerTool("write_account", {}, () => {
    throw new Error("Undeclared tool reached the MCP server.");
  });
  await directory.connect(transport);

  const credential = "mcp-access-canary";
  const refresh = "mcp-refresh-canary";
  const clientSecret = "mcp-client-secret-canary";
  const redirectUri = "http://localhost:19840/v1/extension-connections/oauth/callback";
  let untrustedRegistration = false;
  let registrations = 0;
  let tokenExchanges = 0;
  let revocations = 0;
  const provider = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request, server) {
      const { origin } = server.url;
      switch (new URL(request.url).pathname) {
        case "/mcp":
          if (request.headers.get("authorization") === `Bearer ${credential}`) return transport.handleRequest(request);
          return new Response(null, {
            status: 401,
            headers: { "www-authenticate": `Bearer resource_metadata="${origin}/resource"` },
          });
        case "/resource":
          return Response.json({ resource: `${origin}/mcp`, authorization_servers: [`${origin}/`] });
        case "/.well-known/oauth-authorization-server":
          return Response.json({
            issuer: `${origin}/`,
            authorization_endpoint: `${origin}/authorize`,
            token_endpoint: `${origin}/token`,
            registration_endpoint: untrustedRegistration ? "http://127.0.0.1:1/register" : `${origin}/register`,
            revocation_endpoint: `${origin}/revoke`,
            token_endpoint_auth_methods_supported: ["client_secret_post", "none"],
            code_challenge_methods_supported: ["S256"],
          });
        case "/register": {
          registrations++;
          const registration = await request.json();
          expect(registration).toMatchObject({
            redirect_uris: [redirectUri],
            grant_types: ["authorization_code", "refresh_token"],
            token_endpoint_auth_method: "client_secret_post",
          });
          return Response.json({ client_id: "mcp-client", client_secret: clientSecret }, { status: 201 });
        }
        case "/token": {
          tokenExchanges++;
          const form = new URLSearchParams(await request.text());
          expect(Object.fromEntries(form)).toMatchObject({
            resource: `${origin}/mcp`,
            client_secret: clientSecret,
            client_id: "mcp-client",
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
          });
          return Response.json({ access_token: credential, refresh_token: refresh, token_type: "Bearer" });
        }
        case "/revoke": {
          revocations++;
          const form = new URLSearchParams(await request.text());
          expect(form.get("token")).toBe(refresh);
          expect(form.get("client_secret")).toBe(clientSecret);
          return new Response(null, { status: 204 });
        }
        default:
          return new Response(null, { status: 404 });
      }
    },
  });

  const db = await createDb({ path: ":memory:" });
  try {
    let owner = "account-alice";
    let now = Date.now();
    const grantChanges: string[] = [];
    const secretStore = createMemoryConnectionSecretStore();
    await createProjectsDBService(db.db).create({ id: "project-a", name: "Project A" });
    await createProjectsDBService(db.db).create({ id: "project-b", name: "Project B" });
    const contribution: McpExtensionConnection = {
      id: "crm",
      ref: { kind: "connection", id: "crm" },
      label: "CRM",
      transport: "mcp",
      auth: { type: "oauth", resourceUrl: new URL("/mcp", provider.url).href },
      allowedTools: ["read_accounts"],
    };
    const service = createExtensionConnectionService({
      connectionsDBService: createExtensionConnectionsDBService(db.db),
      secretStore,
      getContribution: async () => contribution,
      oauthOwner: async () => owner,
      onOAuthGrantChanged: (key) => grantChanges.push(key.connectionId),
      now: () => now,
    });
    const named = { projectId: "project-a", extensionId: "test.crm", connectionId: "crm" };
    const api = createExtensionConnectionsApi(service, named);
    const start = async () => {
      const { authorizationUrl } = await service.oauth.start(named, redirectUri);
      expect(authorizationUrl).not.toContain(clientSecret);
      const params = new URL(authorizationUrl).searchParams;
      expect(params.get("resource")).toBe(contribution.auth.resourceUrl);
      return { redirectUri, state: params.get("state")! };
    };

    untrustedRegistration = true;
    await expect(service.oauth.start(named, redirectUri)).rejects.toThrow("outside the declared trusted origin");
    expect(registrations).toBe(0);
    owner = "account-bob";
    await expect(service.oauth.start(named, redirectUri, "account-alice")).rejects.toThrow("account changed");
    await expect(service.oauth.disconnect(named, "account-alice")).rejects.toThrow("account changed");
    expect(registrations).toBe(0);
    expect(grantChanges).toEqual([]);
    owner = "account-alice";
    untrustedRegistration = false;

    const expired = await start();
    now += 11 * 60_000;
    await expect(service.oauth.accept({ ...expired, code: "expired" })).rejects.toThrow("expired");
    const denied = await start();
    await expect(service.oauth.accept({ ...denied, error: "access_denied" })).rejects.toThrow("did not grant access");
    expect(await api.oauthStatus("crm")).toEqual({ status: "disconnected" });
    const cancelled = await start();
    await service.oauth.disconnect(named);
    await expect(service.oauth.accept({ ...cancelled, code: "cancelled" })).rejects.toThrow("expired");

    const callback = await start();
    owner = "account-bob";
    await expect(service.oauth.accept({ ...callback, code: "wrong-user" })).rejects.toThrow("account changed");
    expect(tokenExchanges).toBe(0);
    owner = "account-alice";
    await service.oauth.accept({ ...callback, code: "accepted" });
    expect(grantChanges).toEqual(["crm"]);
    const alice = await api.oauthStatus("crm");
    expect(alice).toMatchObject({ status: "connected", grantId: expect.any(String) });
    expect(JSON.stringify(alice)).not.toContain(credential);
    expect(JSON.stringify(alice)).not.toContain(refresh);
    expect(JSON.stringify(alice)).not.toContain(clientSecret);

    expect(await api.callTool("crm", { name: "read_accounts", arguments: { cursor: "page-2" } })).toMatchObject({
      content: [{ type: "text", text: "Globex" }],
    });
    await expect(api.callTool("crm", { name: "write_account" })).rejects.toThrow("not allowed");
    const elsewhere = createExtensionConnectionsApi(service, { ...named, projectId: "project-b" });
    const otherExtension = createExtensionConnectionsApi(service, { ...named, extensionId: "test.other" });
    await expect(elsewhere.callTool("crm", { name: "read_accounts" })).rejects.toThrow("reconnect_required");
    await expect(otherExtension.callTool("crm", { name: "read_accounts" })).rejects.toThrow("reconnect_required");
    owner = "account-bob";
    await expect(api.callTool("crm", { name: "read_accounts" })).rejects.toThrow("reconnect_required");
    await service.oauth.disconnect(named);
    expect(await api.oauthStatus("crm")).toEqual({ status: "disconnected" });
    expect(toolReads).toBe(1);
    expect(revocations).toBe(0);

    owner = "account-alice";
    expect(await api.oauthStatus("crm")).toEqual(alice);
    await service.oauth.disconnect(named);
    expect(revocations).toBe(1);
    expect(await secretStore.listRefs()).toEqual([]);
  } finally {
    await directory.close();
    await provider.stop(true);
    await db.close();
  }
}, 60_000);
