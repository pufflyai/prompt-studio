import { startProjectDeletionSchema, teamInviteRecipientSchema, teamInviteSecretSchema, teamProjectGrantSchema } from "pstdio-sync-contracts";
import { z } from "zod";
import { AccountFeatureDenied } from "./account-features";
import type { createManagerAuthentication } from "./manager-authentication";
import { ProjectRetired } from "./project-deletion";
import { DeviceAccessDenied } from "./renewal-errors";
import { TeamMembershipDenied } from "./teams";

type Authentication = ReturnType<typeof createManagerAuthentication>;
const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { "cache-control": "no-store" } });
export const readBearer = (request: Request) =>
  /^Bearer[ \t]+(\S+)[ \t]*$/i.exec(request.headers.get("authorization") ?? "")?.[1];

const bearer = (request: Request) => {
  const token = readBearer(request);
  if (!token) throw new DeviceAccessDenied();
  return token;
};
const ok = async (action: Promise<unknown>) => {
  await action;
  return json({ ok: true });
};

const deletionRoute = async (auth: Authentication, request: Request, path: string, accountId?: string) => {
  const { method } = request;
  if (path === "/v1/account" && method === "GET") {
    const account = await auth.devices.account(bearer(request), accountId);
    return json({ ...account, projectDeletion: auth.projectDeletions.enabled });
  }
  if (path === "/v1/project-deletions" && method === "GET")
    return json(await auth.devices.outstandingProjectDeletions(bearer(request), accountId));
  const deletion = /^\/v1\/workbenches\/([^/]+)\/deletion$/.exec(path);
  if (!deletion || (method !== "GET" && method !== "POST")) return null;
  const token = bearer(request);
  let id: string;
  try {
    id = decodeURIComponent(deletion[1]);
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
  if (id.includes("\0")) return json({ error: "Invalid request" }, 400);
  if (method === "GET") {
    const found = await auth.devices.projectDeletion(token, id, accountId);
    return found ? json(found) : json({ error: "Unknown project deletion" }, 404);
  }
  startProjectDeletionSchema.parse(await request.json());
  if (!auth.projectDeletions.enabled) return json({ error: "Cloud project deletion unavailable" }, 503);
  const started = await auth.devices.startProjectDeletion(token, id, accountId);
  if (!started) return json({ error: "Unknown workbench" }, 404);
  return json(started, started.state === "completed" ? 200 : 202);
};

const workbenchRoute = async (
  devices: Authentication["devices"],
  request: Request,
  path: string,
  accountId?: string,
) => {
  const { method } = request;
  const keys = /^\/v1\/workbenches\/([^/]+)\/keys$/.exec(path);
  if (keys && method === "GET") {
    const found = await devices.keys(bearer(request), decodeURIComponent(keys[1]), accountId);
    return found ? json(found) : json({ error: "Unknown workbench" }, 404);
  }
  const workbench = /^\/v1\/workbenches\/([^/]+?)(\/remove)?$/.exec(path);
  if (workbench && method === "POST") {
    const id = decodeURIComponent(workbench[1]);
    return ok(
      workbench[2]
        ? devices.removeWorkbench(bearer(request), id, accountId)
        : devices.addWorkbench(bearer(request), id, accountId),
    );
  }
  return null;
};

const signingKeyRoute = async (devices: Authentication["devices"], request: Request, path: string) => {
  const { method } = request;
  if (path === "/v1/devices/signing-key" && method === "POST") {
    const body = z.strictObject({ publicKey: z.unknown() }).parse(await request.json());
    return ok(devices.registerSigningKey(bearer(request), body.publicKey));
  }
  const signingKey = /^\/v1\/devices\/([^/]+)\/signing-key$/.exec(path);
  if (signingKey && method === "GET") {
    const found = await devices.signingKey(bearer(request), decodeURIComponent(signingKey[1]));
    return found ? json(found) : json({ error: "Unknown device signing key" }, 404);
  }
  return null;
};

const teamRoute = async (devices: Authentication["devices"], request: Request) => {
  const { method } = request;
  if (method === "GET") return json(await devices.teams(bearer(request)));
  if (method === "POST") {
    const token = bearer(request);
    const { name } = z.strictObject({ name: z.string() }).parse(await request.json());
    return json(await devices.createTeam(token, name), 201);
  }
  return null;
};

const teamMembershipRoute = async (auth: Authentication, address: string, request: Request, path: string) => {
  const { devices } = auth;
  const operation = /^\/v1\/teams\/([^/]+)\/(invitations|members|leave)(?:\/([^/]+)\/(cancel|remove))?$/.exec(path);
  if (!operation) return null;
  const token = bearer(request);
  const [, encodedId, section, encodedTarget, action] = operation;
  const id = decodeURIComponent(encodedId);
  const target = encodedTarget && decodeURIComponent(encodedTarget);
  if (request.method === "GET" && !target) {
    if (section === "members") return json(await devices.members(token, id));
    if (section === "invitations") return json(await devices.invitations(token, id));
  }
  if (request.method !== "POST") return null;
  if (section === "invitations" && !target) {
    const recipient = teamInviteRecipientSchema.parse(await request.json());
    if (recipient.microsoft && !auth.supportsSignIn("microsoft"))
      return json({ error: "Microsoft sign-in is unavailable" }, 409);
    const { secret, ...invitation } = await devices.invite(token, id, recipient);
    return json({ ...invitation, url: `${address}/v1/team-invitation#${secret}` }, 201);
  }
  if (section === "invitations" && target && action === "cancel")
    return ok(devices.cancelInvitation(token, id, target));
  if (section === "members" && target && action === "remove") return ok(devices.removeMember(token, id, target));
  return section === "leave" && !target ? ok(devices.leave(token, id)) : null;
};

const teamProjectAccessRoute = async (devices: Authentication["devices"], request: Request, path: string) => {
  const operation = /^\/v1\/teams\/([^/]+)\/projects(?:\/([^/]+)\/access)?$/.exec(path);
  if (!operation) return null;
  const token = bearer(request);
  const teamId = decodeURIComponent(operation[1]);
  if (request.method === "GET" && !operation[2]) return json(await devices.projectAccess(token, teamId));
  if (request.method !== "POST" || !operation[2]) return null;
  const { userId, granted } = teamProjectGrantSchema.parse(await request.json());
  const updated = await devices.updateProjectAccess(token, teamId, decodeURIComponent(operation[2]), userId, granted);
  return updated ? json({ ok: true }) : json({ error: "Unknown workbench" }, 404);
};

const teamInvitationRoute = async (devices: Authentication["devices"], request: Request, path: string) => {
  const operation = /^\/v1\/team-invitations\/(inspect|accept)$/.exec(path);
  if (!operation || request.method !== "POST") return null;
  const token = bearer(request);
  const { secret } = z.strictObject({ secret: teamInviteSecretSchema }).parse(await request.json());
  return json(
    await (operation[1] === "inspect"
      ? devices.inspectInvitation(token, secret)
      : devices.acceptInvitation(token, secret)),
  );
};

const route = async (auth: Authentication, origin: string, request: Request, path: string, accountId?: string) => {
  const { method } = request;
  if (path === "/v1/device-login" && method === "POST") {
    // The provider session may be a browser cookie, so only the manager's own origin can log a device in.
    if (request.headers.get("origin") !== origin) return json({ error: "Origin denied" }, 403);
    return json(await auth.loginDevice(request.headers, await request.json()), 201);
  }
  const devices = auth.devices;
  const signingKey = await signingKeyRoute(devices, request, path);
  if (signingKey) return signingKey;
  if (path === "/v1/devices/presence" && method === "POST") return ok(devices.heartbeat(bearer(request)));
  if (path === "/v1/devices" && method === "GET") return json(await devices.devices(bearer(request)));
  if (path === "/v1/workbenches" && method === "GET")
    return json(await devices.workbenches(bearer(request), accountId));
  const device = /^\/v1\/devices\/([^/]+)\/(rename|remove)$/.exec(path);
  if (device && method === "POST") {
    const id = decodeURIComponent(device[1]);
    if (device[2] === "remove") return ok(devices.remove(bearer(request), id));
    const { name } = (await request.json()) as { name?: unknown };
    if (!(await devices.rename(bearer(request), id, name))) return json({ error: "Unknown device" }, 404);
    return json({ ok: true });
  }
  return path.startsWith("/v1/workbenches/") ? workbenchRoute(devices, request, path, accountId) : null;
};

export const deviceHttp = async (auth: Authentication, address: string, request: Request) => {
  const { pathname: path, searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId") ?? undefined;
  if (
    !["/v1/device-login", "/v1/account", "/v1/project-deletions"].includes(path) &&
    !/^\/v1\/(devices|workbenches|teams|team-invitations)(\/|$)/.test(path)
  )
    return null;
  try {
    return (
      (path === "/v1/teams" ? await teamRoute(auth.devices, request) : null) ??
      (await teamMembershipRoute(auth, address, request, path)) ??
      (await teamInvitationRoute(auth.devices, request, path)) ??
      (await teamProjectAccessRoute(auth.devices, request, path)) ??
      (await deletionRoute(auth, request, path, accountId)) ??
      (await route(auth, new URL(address).origin, request, path, accountId)) ??
      json({ error: "Method not allowed" }, 405)
    );
  } catch (error) {
    if (error instanceof ProjectRetired) return json({ error: error.message }, 410);
    if (error instanceof TeamMembershipDenied) return json({ error: error.message }, 403);
    if (error instanceof AccountFeatureDenied) return json({ error: error.message }, 403);
    if (error instanceof z.ZodError || error instanceof SyntaxError || error instanceof URIError)
      return json({ error: "Invalid request" }, 400);
    if (error instanceof DeviceAccessDenied) return json({ error: "Authentication unavailable" }, 401);
    throw error;
  }
};
