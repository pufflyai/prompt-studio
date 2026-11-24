import { teamInviteSecretSchema } from "pstdio-sync-contracts";
import { z } from "zod";
import type { createManagerAuthentication } from "./manager-authentication";
import { DeviceAccessDenied } from "./renewal-errors";
import { TeamMembershipDenied } from "./team-invitations";

type Authentication = ReturnType<typeof createManagerAuthentication>;

const script = `
const page = location.pathname;
const base = page.slice(0, -"/v1/team-invitation".length);
const key = page;
const button = document.querySelector("button");
const message = document.querySelector("#message");
const title = document.querySelector("h1");
const fragment = location.hash.slice(1);
if (fragment) {
  history.replaceState(null, "", page);
  if (/^[A-Za-z0-9_-]{43}$/.test(fragment)) sessionStorage.setItem(key, fragment);
  else sessionStorage.removeItem(key);
}
const secret = sessionStorage.getItem(key);
const post = (path, body) => fetch(base + path, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

function action(label, execute) {
  button.hidden = false;
  button.textContent = label;
  button.onclick = async () => {
    button.disabled = true;
    try {
      await execute();
    } catch {
      message.textContent = "The account service could not finish that action. Try again.";
    } finally {
      button.disabled = false;
    }
  };
}

async function signIn(changeAccount) {
  if (changeAccount && !(await post("/api/auth/sign-out", {})).ok) throw new Error();
  const result = await post("/api/auth/sign-in/social", {
    provider: "google",
    callbackURL: new URL(page, location.origin).href,
  });
  if (!result.ok) throw new Error();
  const url = new URL((await result.json()).url);
  if (url.origin !== "https://accounts.google.com") throw new Error();
  if (changeAccount) url.searchParams.set("prompt", "select_account");
  location.assign(url);
}

const outcomes = {
  joined: "You have joined the team. Open Cloud settings in Prompt Studio to see it.",
  consumed: "This invitation has already been used.",
  canceled: "This invitation was canceled.",
  expired: "This invitation expired.",
  unknown: "This invitation is unavailable.",
};

async function readInvitation() {
  const result = await post("/v1/team-invitation/inspect", { secret });
  if (result.status === 401) {
    message.textContent = "Sign in with Google to see the invitation.";
    action("Sign in with Google", () => signIn(false));
    return;
  }
  if (!result.ok) throw new Error();
  const view = await result.json();
  if (view.teamName) title.textContent = "Join " + view.teamName;
  document.querySelector("#identity").textContent = view.signedInEmail ? "Signed in as " + view.signedInEmail : "";
  if (view.state === "wrong-identity") {
    message.textContent = "This invitation was sent to a different verified Google account.";
    action("Switch Google account", () => signIn(true));
    return;
  }
  if (view.state === "pending") {
    message.textContent = "Joining gives you access to the team roster. Projects are shared separately.";
    action("Join team", async () => {
      await post("/v1/team-invitation/accept", { secret });
      await readInvitation();
    });
    return;
  }
  button.hidden = true;
  message.textContent = outcomes[view.state] ?? outcomes.unknown;
  if (view.state === "joined") sessionStorage.removeItem(key);
}

if (secret) {
  readInvitation().catch(() => {
    message.textContent = "The invitation could not be loaded. Try again.";
    action("Try again", readInvitation);
  });
} else {
  message.textContent = "Open the invitation link that the team owner shared with you.";
}
`;

const scriptHash = new Bun.CryptoHasher("sha256").update(script).digest("base64");
const html = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Prompt Studio team invitation</title>
<main>
  <h1>Team invitation</h1>
  <p id="identity"></p>
  <p id="message" role="status">Checking invitation…</p>
  <button hidden type="button"></button>
</main>
<script>${script}</script>
</html>`;
const headers = {
  "cache-control": "no-store",
  "referrer-policy": "no-referrer",
  "content-security-policy": `default-src 'none'; script-src 'sha256-${scriptHash}'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'`,
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers });

export const teamInvitationWeb = async (auth: Authentication, origin: string, request: Request, path: string) => {
  if (path === "/v1/team-invitation" && request.method === "GET")
    return new Response(html, { headers: { ...headers, "content-type": "text/html; charset=utf-8" } });
  const action = /^\/v1\/team-invitation\/(inspect|accept)$/.exec(path)?.[1];
  if (!action || request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (request.headers.get("origin") !== origin) return json({ error: "Origin denied" }, 403);

  try {
    const { secret } = z.strictObject({ secret: teamInviteSecretSchema }).parse(await request.json());
    const operation = action === "inspect" ? auth.teamInvitation.inspect : auth.teamInvitation.accept;
    return json(await operation(request.headers, secret));
  } catch (error) {
    if (error instanceof DeviceAccessDenied) return json({ error: "Sign in first" }, 401);
    if (error instanceof TeamMembershipDenied) return json({ error: error.message }, 403);
    if (error instanceof z.ZodError || error instanceof SyntaxError) return json({ error: "Invalid request" }, 400);
    throw error;
  }
};
