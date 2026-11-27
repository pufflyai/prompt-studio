import { createHash, randomBytes } from "node:crypto";
import { unlink } from "node:fs/promises";

export type Preview = { expiresAt: number; workspaceId: string; origin: string };
export type GateOptions = { home: string; root: string; local: string; config: Preview; port: number };
export const securityHeaders = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "same-origin",
  "X-Content-Type-Options": "nosniff",
};
const cookieName = "__Host-pstdio-preview";
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const isToken = (value: string) => /^[A-Za-z0-9_-]{43}$/.test(value);
const script = `
const invitation = new URLSearchParams(location.hash.slice(1)).get("invite") || "";
history.replaceState(null, "", location.pathname);
const status = document.querySelector("p");
try {
  const response = await fetch("/__preview/login", {
    method: "POST", headers: {"Content-Type":"text/plain"}, body: invitation
  });
  if (response.ok) location.replace((await response.json()).location);
  else status.textContent = response.status === 503 ? "Prompt Studio is starting. Open your preview link again shortly." :
    "This preview needs a valid invitation link.";
} catch {
  status.textContent = "Could not connect. Open your preview link again.";
}
`;
export function landing() {
  return new Response(
    '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prompt Studio preview</title><h1>Prompt Studio preview</h1><p>Signing in…</p><script type="module">' +
      script +
      "</script>",
    {
      headers: {
        ...securityHeaders,
        "Content-Type": "text/html;charset=utf-8",
        "Content-Security-Policy": `default-src 'none'; script-src 'sha256-${createHash("sha256").update(script).digest("base64")}'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'`,
      },
    },
  );
}
async function invitationCode(request: Request) {
  const length = Number(request.headers.get("content-length"));
  if (!Number.isInteger(length) || length > 43) return "";
  const reader = request.body?.getReader();
  if (!reader) return "";
  let code = "";
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return code;
    code += decoder.decode(value);
    if (code.length > 43) {
      await reader.cancel();
      return "";
    }
  }
}
export function previewSessions({ home, root, local, config }: GateOptions) {
  const sessions = new Set<string>();
  const invitationPath = (hash: string) => `${root}/invitations/${hash}`;
  const isSignedIn = (request: Request) => {
    const token = request.headers
      .get("cookie")
      ?.split(";")
      .map((value) => value.trim())
      .find((value) => value.startsWith(cookieName + "="))
      ?.slice(cookieName.length + 1);
    return !!token && isToken(token) && sessions.has(digest(token));
  };
  async function mintDashboardLink() {
    const { token } = await Bun.file(home + "/.pstdio/runtime.json").json();
    const result = await fetch(local + "/runtime/browser-login", {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      signal: AbortSignal.timeout(8000),
    });
    if (!result.ok) throw new Error("Dashboard login failed");
    const url = new URL(((await result.json()) as { url: string }).url);
    if (url.origin !== local || url.pathname !== "/" || !url.hash.startsWith("#browser-login="))
      throw new Error("Unexpected dashboard login");
    return "/" + url.hash;
  }
  async function login(request: Request) {
    if (request.method !== "POST" || request.headers.get("origin") !== config.origin)
      return new Response("Forbidden", { status: 403, headers: securityHeaders });
    const code = await invitationCode(request);
    const authenticated = isSignedIn(request);
    const invitation = isToken(code) ? digest(code) : "";
    if (!authenticated && (!invitation || !(await Bun.file(invitationPath(invitation)).exists())))
      return new Response("A valid invitation is required", { status: 401, headers: securityHeaders });
    let location: string;
    try {
      location = await mintDashboardLink();
    } catch {
      return new Response("Prompt Studio is starting", { status: 503, headers: securityHeaders });
    }
    if (authenticated) return Response.json({ location }, { headers: securityHeaders });
    if (
      !(await unlink(invitationPath(invitation)).then(
        () => true,
        () => false,
      ))
    )
      return new Response("A valid invitation is required", { status: 401, headers: securityHeaders });
    const token = randomBytes(32).toString("base64url");
    sessions.add(digest(token));
    const remaining = Math.max(0, Math.floor((config.expiresAt - Date.now()) / 1000));
    return Response.json(
      { location },
      {
        headers: {
          ...securityHeaders,
          "Set-Cookie": `${cookieName}=${token}; Path=/; Max-Age=${remaining}; Secure; HttpOnly; SameSite=Strict`,
        },
      },
    );
  }
  return { isSignedIn, login };
}
