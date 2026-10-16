import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { SQL } from "bun";
import { createAuthorityFixture, provisionAccount } from "./authority.fixture";
import { createGoogleCodeFixture } from "./google-code.fixture";
import * as implementation from "./index";

const fixture = createAuthorityFixture(implementation);
const sql = new SQL(fixture.databaseUrl);
let google: Awaited<ReturnType<typeof createGoogleCodeFixture>>;
beforeAll(async () => {
  await fixture.initialize();
  google = await createGoogleCodeFixture();
});
beforeEach(() => google.reset());
afterAll(() => Promise.all([sql.close(), fixture.close(), google.close()]));

const start = async (
  owner: ReturnType<typeof implementation.createAccountManager>,
  accountId: string,
  claims: Record<string, unknown> = {},
) => {
  const login = implementation.createGoogleLogin(owner, google.config, google.transport);
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  const begun = await login.begin({ expiresAt });
  const callback = await google.authorize(begun.authorizationUrl, accountId, claims);
  return { login, begun, intent: { ...callback, binding: begun.binding, accountId, expiresAt } };
};
const sessionCount = async (accountId: string) =>
  (await sql`SELECT count(*)::integer AS count FROM manager_owner_sessions WHERE "accountId" = ${accountId}`)[0].count;

test("bound state protects code exchange and consumed challenges cannot request another exchange", async () => {
  const owner = fixture.owner();
  try {
    const accountId = await provisionAccount(owner);
    const { login, intent } = await start(owner, accountId);
    await expect(login.complete({ ...intent, binding: "another-browser" })).rejects.toThrow();
    await expect(login.complete({ ...intent, state: "another-state" })).rejects.toThrow();
    expect(google.tokenRequests()).toBe(0);
    const session = await login.complete(intent);
    expect(await owner.authorizeSession(session.token)).toEqual({ accountId });
    await expect(login.complete(intent)).rejects.toThrow();
    expect(google.tokenRequests()).toBe(1);
    const concurrent = await start(owner, accountId);
    const outcomes = await Promise.allSettled([
      concurrent.login.complete(concurrent.intent),
      concurrent.login.complete(concurrent.intent),
    ]);
    expect(outcomes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(await sessionCount(accountId)).toBe(2);
  } finally {
    await owner.close();
  }
});

test("a code for another pending browser fails the real provider PKCE check", async () => {
  const owner = fixture.owner();
  try {
    const accountId = await provisionAccount(owner);
    const first = await start(owner, accountId);
    const second = await start(owner, accountId);
    await expect(second.login.complete({ ...second.intent, code: first.intent.code })).rejects.toThrow();
    expect(await sessionCount(accountId)).toBe(0);
    const session = await first.login.complete(first.intent);
    expect(await owner.authorizeSession(session.token)).toEqual({ accountId });
  } finally {
    await owner.close();
  }
});

test("callback fields cannot supply nonce, identity or Google trust configuration", async () => {
  const owner = fixture.owner();
  try {
    const accountId = await provisionAccount(owner);
    const { login, intent } = await start(owner, accountId);
    for (const key of ["nonce", "owner", "tokenEndpoint", "redirectUri", "clientId"])
      await expect(login.complete({ ...intent, ...{ [key]: "untrusted-callback-claim" } })).rejects.toThrow();
    expect(google.tokenRequests()).toBe(0);
    expect(await owner.authorizeSession((await login.complete(intent)).token)).toEqual({ accountId });
  } finally {
    await owner.close();
  }
});

test("Google code redemption binds the configured client, secret and redirect", async () => {
  const owner = fixture.owner();
  try {
    const accountId = await provisionAccount(owner);
    for (const changed of [
      { clientId: "another-web-client" },
      { clientSecret: "another-client-secret" },
      { redirectUri: "https://manager.example.test/another/callback" },
    ]) {
      const current = await start(owner, accountId);
      const login = implementation.createGoogleLogin(owner, { ...google.config, ...changed }, google.transport);
      await expect(login.complete(current.intent)).rejects.toThrow();
      const session = await current.login.complete(current.intent);
      expect(await owner.authorizeSession(session.token)).toEqual({ accountId });
    }
  } finally {
    await owner.close();
  }
});

test("an expired challenge fails before contacting the token endpoint", async () => {
  const owner = fixture.owner();
  try {
    const accountId = await provisionAccount(owner);
    const login = implementation.createGoogleLogin(owner, google.config, google.transport);
    const expiry = new Date(Date.now() + 1000).toISOString();
    const begun = await login.begin({ expiresAt: expiry });
    const callback = await google.authorize(begun.authorizationUrl, accountId);
    while ((await sql`SELECT clock_timestamp() < ${expiry}::timestamptz AS waiting`)[0].waiting) await Bun.sleep(10);
    await expect(
      login.complete({
        ...callback,
        binding: begun.binding,
        accountId,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      }),
    ).rejects.toThrow();
    expect(google.tokenRequests()).toBe(0);
    expect(await sessionCount(accountId)).toBe(0);
  } finally {
    await owner.close();
  }
});

test("successful exchange still requires the stored nonce and current matching Google owner", async () => {
  const owner = fixture.owner();
  try {
    const accountId = await provisionAccount(owner);
    const wrongNonce = await start(owner, accountId, { nonce: "another-login-nonce", email: "private-profile" });
    await expect(wrongNonce.login.complete(wrongNonce.intent)).rejects.toThrow();
    expect(await sessionCount(accountId)).toBe(0);
    const anotherAccount = await provisionAccount(owner);
    const wrongOwner = await start(owner, accountId);
    await expect(wrongOwner.login.complete({ ...wrongOwner.intent, accountId: anotherAccount })).rejects.toThrow();
    expect(await sessionCount(anotherAccount)).toBe(0);
    expect(google.tokenRequests()).toBe(2);
  } finally {
    await owner.close();
  }
});

test("current lifecycle and restore can deny authority while code exchange is in progress", async () => {
  const owner = fixture.owner();
  try {
    for (const action of ["disable", "reconcile", "restore"]) {
      google.reset();
      const accountId = await provisionAccount(owner);
      const saved = await owner.snapshot();
      const attempt = await start(owner, accountId);
      google.onExchange(async () => {
        if (action === "disable") await owner.disable({ requestId: "disable", accountId });
        if (action === "reconcile")
          await owner.reconcile({
            requestId: "current-owner",
            accountId,
            owner: { issuer: "https://accounts.google.com", subject: "another-owner" },
            state: "active",
          });
        if (action === "restore") await owner.restore("restore-during-code-exchange", saved);
      });
      await expect(attempt.login.complete(attempt.intent)).rejects.toThrow();
      expect(google.tokenRequests()).toBe(1);
      expect(await sessionCount(accountId)).toBe(0);
    }
  } finally {
    await owner.close();
  }
});

test("failed and malformed token responses keep codes and credentials out of error details", async () => {
  const owner = fixture.owner();
  try {
    const accountId = await provisionAccount(owner);
    for (const kind of ["upstream-error", "malformed-json", "missing-token", "invalid-token"]) {
      google.reset();
      const attempt = await start(owner, accountId);
      const secrets = [
        attempt.intent.code,
        attempt.intent.binding,
        google.config.clientSecret,
        "private-profile-marker",
      ];
      const sensitive = secrets.join(" ");
      const responses = {
        "upstream-error": Response.json({ error: sensitive }, { status: 503 }),
        "malformed-json": new Response(`{${sensitive}`),
        "missing-token": Response.json({ profile: sensitive }),
        "invalid-token": Response.json({ id_token: sensitive }),
      };
      google.respondWith(responses[kind as keyof typeof responses]);
      const error = await attempt.login.complete(attempt.intent).catch((reason: unknown) => reason);
      expect(error).toBeInstanceOf(Error);
      for (const secret of secrets) expect(Bun.inspect(error, { depth: Infinity })).not.toContain(secret);
      expect(await sessionCount(accountId)).toBe(0);
    }
  } finally {
    await owner.close();
  }
});

test("token redirects cannot forward the client secret and PKCE verifier", async () => {
  const owner = fixture.owner();
  try {
    const accountId = await provisionAccount(owner);
    const attempt = await start(owner, accountId);
    google.respondWith(Response.redirect(google.redirectTarget, 307));
    await expect(attempt.login.complete(attempt.intent)).rejects.toThrow();
    expect(google.redirectRequests()).toBe(0);
    expect(await sessionCount(accountId)).toBe(0);
  } finally {
    await owner.close();
  }
});

test("the explicit exchange deadline aborts a real pending HTTP request without authority", async () => {
  const owner = fixture.owner();
  try {
    const accountId = await provisionAccount(owner);
    const attempt = await start(owner, accountId);
    google.onExchange(() => Bun.sleep(100));
    const login = implementation.createGoogleLogin(
      owner,
      { ...google.config, exchangeTimeoutMs: 20 },
      google.transport,
    );
    const error = await login.complete(attempt.intent).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(Error);
    expect(await sessionCount(accountId)).toBe(0);
    for (const secret of [attempt.intent.code, attempt.intent.binding, google.config.clientSecret])
      expect(Bun.inspect(error, { depth: Infinity })).not.toContain(secret);
  } finally {
    await owner.close();
  }
});

test("rejected token responses release their unused response body", async () => {
  const owner = fixture.owner();
  try {
    const accountId = await provisionAccount(owner);
    const attempt = await start(owner, accountId);
    google.respondWith(Response.json({ error: "temporarily-unavailable" }, { status: 503 }));
    await expect(attempt.login.complete(attempt.intent)).rejects.toThrow();
    expect(google.tokenResponse()?.bodyUsed).toBe(true);
    expect(await sessionCount(accountId)).toBe(0);
  } finally {
    await owner.close();
  }
});

test("the exchange deadline covers an unfinished streamed JSON body after headers arrive", async () => {
  const owner = fixture.owner();
  let produced: Promise<void> | undefined;
  try {
    const accountId = await provisionAccount(owner);
    const attempt = await start(owner, accountId);
    const encoder = new TextEncoder();
    let finished = false;
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('{"id_token":'));
        produced = Bun.sleep(100).then(() => {
          if (cancelled) return;
          finished = true;
          controller.enqueue(encoder.encode('"delayed-invalid-token"}'));
          controller.close();
        });
      },
      cancel() {
        cancelled = true;
      },
    });
    google.respondWith(new Response(stream, { headers: { "content-type": "application/json" } }));
    const login = implementation.createGoogleLogin(
      owner,
      { ...google.config, exchangeTimeoutMs: 20 },
      google.transport,
    );
    await expect(login.complete(attempt.intent)).rejects.toThrow();
    expect(google.tokenResponse()?.status).toBe(200);
    expect(finished).toBe(false);
    expect(await sessionCount(accountId)).toBe(0);
  } finally {
    await produced;
    await owner.close();
  }
});
