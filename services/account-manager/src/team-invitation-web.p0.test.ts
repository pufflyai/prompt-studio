import { expect, test } from "bun:test";
import { runInNewContext } from "node:vm";
import { teamInvitationWeb } from "./team-invitation-web";

test("invitation failure can be retried and terminal outcomes clear the link", async () => {
  const origin = "https://accounts.example.test";
  const page = "/v1/team-invitation";
  const secret = "a".repeat(43);
  const url = origin + page;
  // Serving this page needs no human session. Its POST requests are exercised separately by the authority integration.
  const html = await teamInvitationWeb({} as Parameters<typeof teamInvitationWeb>[0], origin, new Request(url), page);
  const script = (await html.text()).match(/<script>([\s\S]+)<\/script>/)?.[1];
  if (!script) throw new Error("Invitation script missing");
  const button = { hidden: true, disabled: false, textContent: "", onclick: null as (() => Promise<void>) | null };
  const message = { textContent: "" };
  const title = { textContent: "Team invitation" };
  const identity = { textContent: "" };
  const nodes = { button, "#message": message, h1: title, "#identity": identity, "#handoff": { hidden: true } };
  const storage = new Map<string, string>();
  let navigation: URL | undefined;
  const location = {
    pathname: page,
    hash: `#${secret}`,
    origin,
    assign: (target: URL) => (navigation = target),
  };
  let hashChanged: (() => Promise<void>) | undefined;
  let inspection = Response.json({
    state: "pending",
    teamName: "Studio Team",
    signedInEmail: "recipient@example.test",
  });
  let status = 503;
  const fetch = async (path: string, init: RequestInit) => {
    if (path === "/api/auth/sign-in/social") {
      expect(JSON.parse(String(init.body))).toEqual({ provider: "microsoft", callbackURL: url });
      return Response.json({ url: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?state=test" });
    }
    const replies = {
      "/v1/team-invitation/inspect": () => inspection.clone(),
      "/v1/team-invitation/accept": () => new Response(null, { status }),
    };
    return replies[path as keyof typeof replies]();
  };
  await runInNewContext(script, {
    URL,
    location,
    history: { replaceState: () => (location.hash = "") },
    window: { addEventListener: (_event: string, listener: () => Promise<void>) => (hashChanged = listener) },
    document: { querySelector: (name: keyof typeof nodes) => nodes[name] },
    sessionStorage: {
      getItem: storage.get.bind(storage),
      setItem: storage.set.bind(storage),
      removeItem: storage.delete.bind(storage),
    },
    fetch,
  });

  expect(button.textContent).toBe("Join team");
  await button.onclick?.();
  expect(message.textContent).toBe("The account service could not finish that action. Try again.");
  expect(storage.get(page)).toBe(secret);

  status = 200;
  await button.onclick?.();
  expect(message.textContent).toContain("You have joined the team.");
  expect(button.hidden).toBe(true);
  expect(storage.has(page)).toBe(false);

  inspection = new Response(null, { status: 401 });
  location.hash = `#${"b".repeat(43)}`;
  await hashChanged?.();
  expect(button.textContent).toBe("Sign in with Google");
  expect(title.textContent).toBe("Team invitation");
  expect(identity.textContent).toBe("");
  expect(location.hash).toBe("");

  inspection = Response.json({ provider: "microsoft" }, { status: 401 });
  location.hash = `#${"m".repeat(43)}`;
  await hashChanged?.();
  expect(button.textContent).toBe("Sign in with Microsoft");
  await button.onclick?.();
  expect(navigation?.hostname).toBe("login.microsoftonline.com");
  expect(location.hash).toBe("");

  inspection = Response.json({ state: "expired" });
  location.hash = `#${"c".repeat(43)}`;
  await hashChanged?.();
  expect(message.textContent).toBe("This invitation expired.");
  expect(nodes["#handoff"].hidden).toBe(false);
  expect(storage.has(page)).toBe(false);
});
