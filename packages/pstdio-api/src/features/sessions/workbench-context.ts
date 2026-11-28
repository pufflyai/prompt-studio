import { OpenAPIHono, z } from "@hono/zod-openapi";
import type { SessionMessageSender } from "pstdio-api-contracts";
import {
  type WorkbenchContext,
  type WorkbenchOrigin,
  workbenchContextSchema,
  workbenchOriginSchema,
} from "pstdio-api-contracts";
import type { AppBindings } from "../../types";
import { readDeviceCommandResult } from "../account/device-command-response";
import type { SessionsRouteDeps } from "./deps";

export type WorkbenchSender = SessionMessageSender & { workbenchOrigin?: WorkbenchOrigin };
const clients = new WeakMap<
  SessionsRouteDeps["sessionService"],
  Map<
    string,
    {
      context?: WorkbenchContext;
      observedAt: string;
      receivedAt: number;
    }
  >
>();
const liveContexts = (deps: SessionsRouteDeps) => {
  let entries = clients.get(deps.sessionService);
  if (!entries) {
    entries = new Map();
    clients.set(deps.sessionService, entries);
  }
  return entries;
};
const clientKey = (projectId: string, id: string) => JSON.stringify([projectId, id]);
const liveLifetime = 30_000;

export const submittedWorkbenchOrigin = (value: unknown, projectId: string) => {
  const parsed = workbenchOriginSchema.safeParse(value);
  if (!parsed.success || parsed.data.snapshot.project.id !== projectId) return;
  const { main, panels, selection } = parsed.data.snapshot;
  const resources = [main.resource, ...panels.map((panel) => panel.resource)];
  if (selection.kind === "resources") resources.push(...selection.items);
  if (selection.kind === "text") resources.push(selection.document);
  if (resources.some((resource) => resource && resource.projectId !== projectId)) return;
  return parsed.data;
};

export const getLiveWorkbenchContext = (deps: SessionsRouteDeps, projectId: string, id: string) => {
  const live = liveContexts(deps).get(clientKey(projectId, id));
  return live && Date.now() - live.receivedAt <= liveLifetime ? live.context : undefined;
};

export const forwardingWorkbenchOrigin = async (deps: SessionsRouteDeps, origin: WorkbenchOrigin | undefined) => {
  if (!origin) return;
  const { login } = await deps.accountService.status();
  return login?.deviceId ? { ...origin, deviceId: login.deviceId } : undefined;
};

const unavailable = (reason: string) => ({ status: "unavailable", reason });

export const createWorkbenchContextRoutes = (deps: SessionsRouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();
  const livePath = "/projects/:projectId/workbench-context/:clientId";
  routes.put(livePath, async (c) => {
    const { projectId, clientId } = c.req.param();
    const raw = await c.req.json().catch(() => undefined);
    const origin = submittedWorkbenchOrigin({ id: clientId, snapshot: raw }, projectId);
    if (!origin || !(await deps.projectService.get(projectId)))
      return c.json({ error: "Invalid workbench context." }, 400);
    const entries = liveContexts(deps);
    const now = Date.now();
    const key = clientKey(projectId, clientId);
    for (const [key, state] of entries) if (now - state.receivedAt > liveLifetime) entries.delete(key);
    if (!entries.has(key) && entries.size >= 256) return c.json({ error: "Workbench capacity reached." }, 429);
    const previous = entries.get(key);
    if (
      !previous ||
      previous.observedAt < origin.snapshot.observedAt ||
      (previous.context && previous.observedAt === origin.snapshot.observedAt)
    )
      entries.set(key, { context: origin.snapshot, observedAt: origin.snapshot.observedAt, receivedAt: now });
    return c.body(null, 204);
  });
  routes.delete(livePath, (c) => {
    const { projectId, clientId } = c.req.param();
    const entries = liveContexts(deps);
    const key = clientKey(projectId, clientId);
    const now = Date.now();
    for (const [key, state] of entries) if (now - state.receivedAt > liveLifetime) entries.delete(key);
    if (z.uuid().safeParse(clientId).success && projectId.length <= 512 && (entries.has(key) || entries.size < 256)) {
      const at = c.req.query("at");
      const observedAt = at && Number.isFinite(Date.parse(at)) ? at : new Date().toISOString();
      entries.set(key, { observedAt, receivedAt: now });
    }
    return c.body(null, 204);
  });
  routes.get("/projects/:projectId/sessions/:sessionId/workbench-context", async (c) => {
    const { projectId, sessionId } = c.req.param();
    const session = await deps.sessionService.get(sessionId);
    if (!session || session.project_id !== projectId) return c.json(unavailable("session-unavailable"));
    const origin = deps.sessionService.store.get(sessionId)?.workbenchOrigin;
    if (!origin || origin.snapshot.project.id !== projectId) return c.json(unavailable("no-attached-workbench"));
    if (c.req.query("atSend") === "true")
      return c.json({ status: "available", freshness: "at-send", context: origin.snapshot });
    const live = origin.deviceId
      ? await readDeviceCommandResult(
          deps.accountService,
          projectId,
          origin.deviceId,
          { type: "workbench.context", id: origin.id },
          c.req.raw.signal,
        )
          .then(({ body, status }) => (status === 200 ? workbenchContextSchema.safeParse(body).data : undefined))
          .catch(() => undefined)
      : getLiveWorkbenchContext(deps, projectId, origin.id);
    if (!live || live.project.id !== projectId) return c.json(unavailable("workbench-disconnected"));
    return c.json({ status: "available", freshness: "live", context: live });
  });
  return routes;
};
