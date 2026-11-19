import { projectDeletionAcknowledgementSchema, projectDeletionServicePath } from "pstdio-sync-contracts";
import { readBearer } from "./device-http";
import type { createManagerAuthentication } from "./manager-authentication";

export const projectDeletionServiceHttp = async (
  auth: ReturnType<typeof createManagerAuthentication>,
  request: Request,
  path: string,
) => {
  if (path !== projectDeletionServicePath) return null;
  const json = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: { "cache-control": "no-store" } });
  const token = readBearer(request);
  const service = auth.projectDeletions;
  if (!token || !service.authenticate(token)) return json({ error: "Authentication unavailable" }, 401);
  if (request.method === "GET") return json(await service.jobs());
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const acknowledgement = projectDeletionAcknowledgementSchema.safeParse(await request.json().catch(() => null));
  if (!acknowledgement.success) return json({ error: "Invalid deletion acknowledgement" }, 400);
  const completed = await service.acknowledge(acknowledgement.data);
  return completed ? json(completed) : json({ error: "Unknown deletion operation" }, 404);
};
