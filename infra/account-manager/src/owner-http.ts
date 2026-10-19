import type { createManagerAuthentication } from "./manager-authentication";

type Authentication = ReturnType<typeof createManagerAuthentication>;
const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { "cache-control": "no-store" } });
const accounts = async (auth: Authentication, origin: string, request: Request) => {
  if (request.method === "POST" && request.headers.get("origin") !== origin)
    return json({ error: "Origin denied" }, 403);
  if (request.method === "GET") return json(await auth.ownerAccounts.list(request.headers));
  if (request.method === "POST") return json(await auth.ownerAccounts.create(request.headers), 201);
  return json({ error: "Method not allowed" }, 405);
};
export const ownerHttp = async (auth: Authentication, origin: string, request: Request) => {
  const path = new URL(request.url).pathname;
  try {
    if (path === "/v1/owner/accounts") return await accounts(auth, origin, request);
    if (path === "/v1/owner/configuration" && request.method === "GET") {
      await auth.ownerAccounts.list(request.headers);
      return json(auth.configuration);
    }
    const workbenches = /^\/v1\/accounts\/([^/]+)\/workbenches$/.exec(path);
    if (workbenches && request.method === "GET")
      return json(await auth.forSession(request.headers, decodeURIComponent(workbenches[1])).workbenches());
    return null;
  } catch {
    return json({ error: "Authentication unavailable" }, 401);
  }
};
