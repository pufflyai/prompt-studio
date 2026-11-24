import { z } from "zod";
import {
  type AccessConfig,
  AccessError,
  bindings,
  type Role,
  roleScopes,
  runInputSchema,
  storageBinding,
} from "./config";
import type { Controller } from "./controller";
import type { GrantStore } from "./grants";
import type { VerifiedIdentity } from "./identity";
import type { StorageAccess } from "./storage-access";

type Deps = {
  config: () => AccessConfig;
  verify: (request: Request) => Promise<VerifiedIdentity>;
  controller: Controller;
  store: GrantStore;
  storage?: StorageAccess;
  preview?: (workspaceId: string, deadline: string) => Promise<{ url: string; expiresAt: string }>;
};
const sessionInput = z.strictObject({ runId: z.uuid().optional() });

export function createAccessService(deps: Deps) {
  const { store, controller } = deps;
  async function authorize(identity: VerifiedIdentity, runId?: string) {
    const config = deps.config();
    if (identity.human) {
      const person = config.humans.find((h) => h.provider === identity.provider && h.subject === identity.subject);
      if (!person || runId) throw new AccessError(403, "Cloud access is not granted.");
      return {
        principalId: person.principalId,
        roles: person.roles,
        templates: config.templates,
        deadline: identity.expiresAt,
        storageDeadline: Date.now() + config.maxRunSeconds * 1000,
      };
    }
    const grant = runId && (await store.get(runId));
    if (!grant || grant.revoked || Date.parse(grant.deadline) <= Date.now() || grant.subject !== identity.subject)
      throw new AccessError(403, "Run access is not granted.");
    if (grant.instance && JSON.stringify(grant.instance) !== JSON.stringify(identity.instance))
      throw new AccessError(403, "The VM does not own this run.");
    return {
      principalId: grant.principalId,
      roles: grant.roles.filter((role) => config.workloadRoles.includes(role)),
      templates: grant.templates.filter((template) => config.templates.includes(template)),
      deadline: Math.min(identity.expiresAt, Date.parse(grant.deadline)),
      storageDeadline: Date.parse(grant.deadline),
    };
  }

  async function body(request: Request) {
    const text = await request.text();
    if (text.length > 16384) throw new AccessError(413, "Request is too large.");
    try {
      return JSON.parse(text);
    } catch {
      throw new AccessError(400, "Invalid JSON request.");
    }
  }

  async function session(identity: VerifiedIdentity, input: z.infer<typeof sessionInput>) {
    const authority = await authorize(identity, input.runId);
    const config = deps.config();
    const expires = Math.min(Date.now() + config.sessionSeconds * 1000, authority.deadline);
    if (expires < Date.now() + 30_000 || !authority.roles.length || !authority.templates.length)
      throw new AccessError(403, "Cloud authorization has ended.");
    const issued: { id: string; secret: string; expiresAt: string; role: Role }[] = [];
    try {
      for (const role of authority.roles) {
        const templates =
          role === "publisher" ? authority.templates.filter((name) => name.endsWith("-branch")) : authority.templates;
        if (!templates.length) continue;
        issued.push({
          ...(await controller.issue(
            authority.principalId,
            roleScopes[role],
            templates,
            new Date(expires).toISOString(),
          )),
          role,
        });
      }
      if (!issued.length) throw new AccessError(403, "Cloud authorization has ended.");
    } catch (error) {
      await Promise.allSettled(issued.map((key) => controller.revokeKey(authority.principalId, key.id)));
      throw error;
    }
    const actualExpiry = Math.min(expires, ...issued.map((key) => Date.parse(key.expiresAt)));
    const credentials = issued.map((key) => ({
      ...bindings[key.role],
      secret: key.secret,
      baseUrl: config.controllerUrl,
    }));
    if (deps.storage && authority.roles.includes("runner"))
      credentials.push({
        ...storageBinding,
        baseUrl: config.audience,
        secret: await deps.storage.issue(identity, input.runId, new Date(actualExpiry).toISOString()),
      });
    return {
      controllerUrl: config.controllerUrl,
      settings: config.settings,
      manifests: config.manifests,
      expiresAt: new Date(actualExpiry).toISOString(),
      renewAt: new Date(Date.now() + (actualExpiry - Date.now()) * 0.6).toISOString(),
      credentials,
      preview: Boolean(config.previewHelper && authority.roles.some((role) => role !== "publisher")),
    };
  }

  async function registerRun(request: Request, identity: VerifiedIdentity) {
    const config = deps.config();
    const input = runInputSchema.parse(await body(request));
    const deadline = Date.parse(input.deadline);
    if (deadline <= Date.now() || deadline > Date.now() + config.maxRunSeconds * 1000)
      throw new AccessError(400, "Run deadline is outside the allowed lifetime.");
    await store.assertNew(input.runId);
    await store.assertSubjectBinding(input.subject, Boolean(input.instance));
    const scopes = [...new Set(config.workloadRoles.flatMap((role) => roleScopes[role]))];
    const principalId = await controller.createPrincipal(`run:${input.runId}`, scopes, config.templates);
    try {
      await store.save({
        ...input,
        principalId,
        launcher: identity.subject,
        revoked: false,
        roles: config.workloadRoles,
        templates: config.templates,
      });
    } catch (error) {
      await controller.revoke(principalId);
      throw error;
    }
    return { runId: input.runId, deadline: input.deadline };
  }

  async function revokeRun(id: string, identity: VerifiedIdentity) {
    const grant = await store.get(z.uuid().parse(id));
    if (!grant || grant.launcher !== identity.subject) throw new AccessError(403, "Run ownership is required.");
    await store.save({ ...grant, revoked: true });
    await controller.revoke(grant.principalId);
    return { revoked: true };
  }

  async function preview(request: Request, identity: VerifiedIdentity) {
    const input = sessionInput.extend({ workspaceId: z.uuid() }).parse(await body(request));
    const prepared = await store.exclusive(async () => {
      const authority = await authorize(identity, input.runId);
      if (!deps.preview || !deps.config().previewHelper || !authority.roles.some((r) => r !== "publisher"))
        throw new AccessError(403, "Preview access is not configured.");
      const expiry = new Date(Math.min(Date.now() + 60_000, authority.deadline)).toISOString();
      const key = await controller.issue(authority.principalId, ["workspaces:read"], authority.templates, expiry);
      return { key, authority };
    });
    try {
      await controller.workspace(input.workspaceId, prepared.key.secret);
      const result = await deps.preview!(input.workspaceId, new Date(prepared.authority.deadline).toISOString());
      const current = await authorize(identity, input.runId);
      if (Date.parse(result.expiresAt) > current.deadline || Date.parse(result.expiresAt) <= Date.now())
        throw new AccessError(502, "Preview lifetime exceeds the authorized run.");
      return result;
    } finally {
      await controller.revokeKey(prepared.authority.principalId, prepared.key.id);
    }
  }

  const response = (value: unknown, status = 200) =>
    Response.json(value, {
      status,
      headers: { "Cache-Control": "no-store", "Content-Type": "application/json" },
    });
  const publicResponse = (request: Request) => {
    if (request.method !== "GET") return;
    const path = new URL(request.url).pathname;
    if (path === "/healthz") return response({ ok: true });
    if (path === "/v1/login/microsoft") {
      const microsoft = deps.config().microsoft;
      return microsoft ? response(microsoft) : response({ error: "Microsoft sign-in is not configured." }, 404);
    }
  };
  const fetch = async (request: Request) => {
    const url = new URL(request.url);
    try {
      const discovery = publicResponse(request);
      if (discovery) return discovery;
      if (request.method === "POST" && ["/v1/storage/url", "/v1/storage/check"].includes(url.pathname)) {
        if (!deps.storage) throw new AccessError(403, "Cloud storage is not configured.");
        return response(await deps.storage.handle(request, authorize));
      }
      const identity = await deps.verify(request);
      if (request.method === "POST" && url.pathname === "/v1/preview")
        return response(await preview(request, identity));
      return await store.exclusive(async () => {
        if (request.method === "POST" && url.pathname === "/v1/session")
          return response(await session(identity, sessionInput.parse(await body(request))));

        const config = deps.config();
        if (identity.human || !config.launchers.includes(identity.subject))
          throw new AccessError(403, "Launcher access is required.");
        if (request.method === "POST" && url.pathname === "/v1/runs")
          return response(await registerRun(request, identity), 201);
        const match = url.pathname.match(/^\/v1\/runs\/([0-9a-f-]{36})$/i);
        if (request.method === "DELETE" && match) return response(await revokeRun(match[1]!, identity));
        return response({ error: "Unknown endpoint." }, 404);
      });
    } catch (error) {
      if (error instanceof z.ZodError) return response({ error: "Invalid request." }, 400);
      if (error instanceof AccessError) return response({ error: error.message }, error.status);
      // Never reflect identity tokens, process output or controller error bodies.
      return response({ error: "Cloud access is unavailable." }, 502);
    }
  };
  return { fetch };
}
