import { securityHeaders } from "./preview-session";

const forwardHeaders = [
  "accept",
  "accept-language",
  "authorization",
  "content-type",
  "if-none-match",
  "if-modified-since",
  "range",
];
export async function forwardHttp(destination: URL, request: Request, local: string) {
  const origin = request.headers.get("origin");
  const headers = new Headers();
  for (const name of forwardHeaders) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (origin) headers.set("Origin", local);
  try {
    const response = await fetch(destination, {
      method: request.method,
      headers,
      body: request.body,
      redirect: "manual",
      signal: request.signal,
    });
    const outgoing = new Headers(response.headers);
    for (const name of [
      "set-cookie",
      "access-control-allow-origin",
      "access-control-allow-credentials",
      "content-encoding",
      "content-length",
    ])
      outgoing.delete(name);
    for (const [name, value] of Object.entries(securityHeaders)) outgoing.set(name, value);
    outgoing.set("X-Frame-Options", "SAMEORIGIN");
    const location = outgoing.get("location");
    if (location?.startsWith(local + "/")) outgoing.set("location", location.slice(local.length));
    return new Response(response.body, { status: response.status, headers: outgoing });
  } catch {
    return new Response("Prompt Studio is starting", { status: 503, headers: securityHeaders });
  }
}
