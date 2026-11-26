import { teamInviteSecretSchema } from "pstdio-sync-contracts";
import { z } from "zod";
import type { createManagerAuthentication } from "./manager-authentication";
import { DeviceAccessDenied } from "./renewal-errors";
import { TeamMembershipDenied } from "./teams";

type Authentication = ReturnType<typeof createManagerAuthentication>;

const script = `
const page = location.pathname;
const base = page.slice(0, -"/v1/team-invitation".length);
const key = page;
const button = document.querySelector("button");
const message = document.querySelector("#message");
const title = document.querySelector("h1");
const identity = document.querySelector("#identity");
const handoff = document.querySelector("#handoff");
let secret;
const post = (path, body) => fetch(base + path, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

function action(label, execute) {
  button.hidden = false;
  button.disabled = false;
  button.textContent = label;
  const invoke = async () => {
    button.disabled = true;
    try {
      await execute();
    } catch {
      if (button.onclick === invoke) {
        message.textContent = "The account service could not finish that action. Try again.";
      }
    } finally {
      if (button.onclick === invoke) button.disabled = false;
    }
  };
  button.onclick = invoke;
}

const providers = {
  google: { label: "Google", endpoint: "https://accounts.google.com/o/oauth2/v2/auth" },
  microsoft: { label: "Microsoft", endpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize" },
};

async function signIn(changeAccount, provider, invitation) {
  if (changeAccount && !(await post("/api/auth/sign-out", {})).ok) throw new Error();
  const callbackURL = new URL(page, location.origin).href;
  const result = await post("/api/auth/sign-in/social", {
    provider,
    callbackURL,
    errorCallbackURL: callbackURL + "/sign-in-error",
  });
  if (!result.ok) throw new Error();
  const url = new URL((await result.json()).url);
  if (url.origin + url.pathname !== providers[provider].endpoint) throw new Error();
  if (invitation !== secret) return;
  if (changeAccount) url.searchParams.set("prompt", "select_account");
  location.assign(url);
}

const outcomes = {
  joined: "You have joined the team.",
  consumed: "This invitation has already been used.",
  canceled: "This invitation was canceled.",
  expired: "This invitation expired.",
  unknown: "This invitation is unavailable.",
};

function showOutcome(state) {
  button.hidden = true;
  button.onclick = null;
  message.textContent = outcomes[state] ?? outcomes.unknown;
  handoff.hidden = false;
  sessionStorage.removeItem(key);
  secret = null;
}

async function acceptInvitation() {
  const invitation = secret;
  const result = await post("/v1/team-invitation/accept", { secret: invitation }).catch(() => null);
  if (invitation !== secret) return;
  if (result?.ok) {
    showOutcome("joined");
    return;
  }
  // The server may have committed the join before the response was lost.
  if (await readInvitation(invitation) === "pending") {
    message.textContent = "The account service could not finish that action. Try again.";
  }
}

async function readInvitation(invitation = secret, signInFailed = false) {
  const result = await post("/v1/team-invitation/inspect", { secret: invitation });
  if (invitation !== secret) return;
  if (result.status === 401) {
    const challenge = await result.json().catch(() => null);
    if (invitation !== secret) return;
    const provider = challenge?.provider === "microsoft" ? "microsoft" : "google";
    const label = providers[provider].label;
    title.textContent = "Team invitation";
    identity.textContent = "";
    message.textContent = signInFailed
      ? "Sign-in did not complete. Try again."
      : "Sign in with " + label + " to see the invitation.";
    action("Sign in with " + label, () => signIn(false, provider, invitation));
    return;
  }
  if (!result.ok) throw new Error();
  const view = await result.json();
  if (invitation !== secret) return;
  title.textContent = view.teamName ? "Join " + view.teamName : "Team invitation";
  identity.textContent = view.signedInEmail ? "Signed in as " + view.signedInEmail : "";
  if (view.state === "wrong-identity") {
    const provider = view.provider === "microsoft" ? "microsoft" : "google";
    const label = providers[provider].label;
    message.textContent = "This invitation was sent to a different verified " + label + " account.";
    action("Switch " + label + " account", () => signIn(true, provider, invitation));
    return;
  }
  if (view.state === "pending") {
    message.textContent = "Joining gives you access to the team roster. Projects are shared separately.";
    action("Join team", acceptInvitation);
    return view.state;
  }
  showOutcome(view.state);
}

function loadInvitation() {
  const fragment = location.hash.slice(1);
  const signInFailed = new URLSearchParams(location.search).get("sign-in") === "retry";
  if (fragment || signInFailed) history.replaceState(null, "", page);
  if (fragment) {
    if (/^[A-Za-z0-9_-]{43}$/.test(fragment)) sessionStorage.setItem(key, fragment);
    else sessionStorage.removeItem(key);
  }
  secret = sessionStorage.getItem(key);
  title.textContent = "Team invitation";
  identity.textContent = "";
  button.hidden = true;
  button.onclick = null;
  handoff.hidden = true;
  if (!secret) {
    message.textContent = "Open the invitation link that the team owner shared with you.";
    return;
  }
  message.textContent = "Checking invitation…";
  const invitation = secret;
  return readInvitation(invitation, signInFailed).catch(() => {
    if (invitation !== secret) return;
    message.textContent = "The invitation could not be loaded. Try again.";
    action("Try again", () => readInvitation(invitation));
  });
}

window.addEventListener("hashchange", loadInvitation);
loadInvitation();
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
  <p id="handoff" hidden>Return to Prompt Studio and open Cloud settings.</p>
</main>
<script>${script}</script>
</html>`;
const headers = {
  "cache-control": "no-store",
  "referrer-policy": "no-referrer",
  "content-security-policy": `default-src 'none'; script-src 'sha256-${scriptHash}'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'`,
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers });

export const teamInvitationWeb = async (auth: Authentication, address: string, request: Request, path: string) => {
  if (path === "/v1/team-invitation/sign-in-error" && request.method === "GET")
    return new Response(null, {
      status: 303,
      headers: { ...headers, location: `${address}/v1/team-invitation?sign-in=retry` },
    });
  if (path === "/v1/team-invitation" && request.method === "GET")
    return new Response(html, { headers: { ...headers, "content-type": "text/html; charset=utf-8" } });
  const action = /^\/v1\/team-invitation\/(inspect|accept)$/.exec(path)?.[1];
  if (!action || request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (request.headers.get("origin") !== new URL(address).origin) return json({ error: "Origin denied" }, 403);

  try {
    const { secret } = z.strictObject({ secret: teamInviteSecretSchema }).parse(await request.json());
    const operation = action === "inspect" ? auth.teamInvitation.inspect : auth.teamInvitation.accept;
    try {
      return json(await operation(request.headers, secret));
    } catch (error) {
      if (!(error instanceof DeviceAccessDenied)) throw error;
      const provider = action === "inspect" ? await auth.teamInvitation.provider(secret) : undefined;
      return json({ error: "Sign in first", provider }, 401);
    }
  } catch (error) {
    if (error instanceof TeamMembershipDenied) return json({ error: error.message }, 403);
    if (error instanceof z.ZodError || error instanceof SyntaxError) return json({ error: "Invalid request" }, 400);
    throw error;
  }
};
