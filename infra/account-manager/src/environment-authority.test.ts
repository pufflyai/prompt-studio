import { afterAll, beforeAll, expect, test } from "bun:test";
import { Client } from "pg";
import { createAuthorityFixture, provisionAccount, registration } from "./authority.fixture";
import { startEnvironmentAuthority } from "./environment-authority.fixture";
import * as implementation from "./index";

const fixture = createAuthorityFixture(implementation);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("a private HTTP caller receives current token scope without manager database access", async () => {
  const manager = fixture.owner();
  const ordinaryRelay = new Client({ connectionString: fixture.relayUrl });
  const boundary = startEnvironmentAuthority(implementation, manager);
  try {
    const first = await provisionAccount(manager);
    const second = await provisionAccount(manager);
    const firstIntent = registration(first);
    const secondIntent = registration(second);
    const a = await manager.register(firstIntent);
    const b = await manager.register(secondIntent);
    const client = boundary.client;
    const denied = await ordinaryRelay.connect().catch((error: unknown) => error);
    expect(denied).toMatchObject({ code: "42501" });
    expect(await client.authorize(a.token!, firstIntent.workbenchId)).toEqual({
      accountId: first,
      workbenchId: firstIntent.workbenchId,
      environmentId: firstIntent.environmentId,
    });
    expect(await client.authorize(b.token!, secondIntent.workbenchId)).toEqual({
      accountId: second,
      workbenchId: secondIntent.workbenchId,
      environmentId: secondIntent.environmentId,
    });
    expect(await client.authorize(a.token!, "another-workbench")).toBeNull();
    expect(await client.authorize("unknown-token", firstIntent.workbenchId)).toBeNull();
    const result = await client.authorize(a.token!, firstIntent.workbenchId);
    expect(JSON.stringify(result)).not.toContain(a.token!);
    expect(JSON.stringify(result)).not.toContain(boundary.config.serviceSecret);
  } finally {
    await boundary.close();
    await Promise.all([manager.close(), ordinaryRelay.end()]);
  }
});

test("service authentication precedes body validation and closed database access", async () => {
  const manager = fixture.owner();
  const boundary = startEnvironmentAuthority(implementation, manager);
  await manager.close();
  try {
    const malformed = () =>
      new Request(new URL("/internal/v1/environment-authority", boundary.url), {
        method: "POST",
        body: "not-json",
      });
    const anonymous = await fetch(malformed());
    expect(anonymous.status).toBe(401);
    expect(anonymous.headers.get("www-authenticate")).toBe('Bearer realm="environment-authority"');
    expect(anonymous.headers.get("cache-control")).toBe("no-store");
    await anonymous.body?.cancel();
    const invalid = malformed();
    invalid.headers.set("authorization", `Bearer ${boundary.config.serviceSecret}`);
    const parsed = await fetch(invalid);
    expect(parsed.status).toBe(400);
    await parsed.body?.cancel();
    const denied = await boundary.request({ token: "untrusted", workbenchId: "workbench" }, "wrong-service");
    expect(denied.status).toBe(401);
    expect(denied.headers.get("www-authenticate")).toBe('Bearer realm="environment-authority"');
    await denied.body?.cancel();
    const unavailable = await boundary.request({ token: "untrusted", workbenchId: "workbench" });
    expect(unavailable.status).toBe(503);
    await unavailable.body?.cancel();
    const error = await boundary.client.authorize("untrusted", "workbench").catch((error: unknown) => error);
    expect(error).toBeInstanceOf(Error);
  } finally {
    await boundary.close();
  }
});

test("private requests cannot supply authority claims or invoke administration", async () => {
  const manager = fixture.owner();
  const boundary = startEnvironmentAuthority(implementation, manager);
  try {
    const accountId = await provisionAccount(manager);
    const intent = registration(accountId);
    const grant = await manager.register(intent);
    for (const field of ["accountId", "environmentId", "owner", "endpoint", "serviceSecret"]) {
      const response = await boundary.request({
        token: grant.token,
        workbenchId: intent.workbenchId,
        [field]: "claim",
      });
      expect(response.status).toBe(400);
      await response.body?.cancel();
    }
    const wrongService = await boundary.request({ token: grant.token, workbenchId: intent.workbenchId }, grant.token!);
    expect(wrongService.status).toBe(401);
    await wrongService.body?.cancel();
    expect(await boundary.client.authorize(boundary.config.serviceSecret, intent.workbenchId)).toBeNull();
    for (const path of ["/internal/v1/provision", "/internal/v1/restore", "/internal/v1/reconcile"]) {
      const response = await boundary.request({ accountId }, boundary.config.serviceSecret, path);
      expect(response.status).toBe(404);
      await response.body?.cancel();
    }
    expect(await boundary.client.authorize(grant.token!, intent.workbenchId)).not.toBeNull();
  } finally {
    await boundary.close();
    await manager.close();
  }
});

test("an existing HTTP client rechecks authority after manager process restart", async () => {
  const first = fixture.owner();
  const original = startEnvironmentAuthority(implementation, first);
  const accountId = await provisionAccount(first);
  const intent = registration(accountId);
  const grant = await first.register(intent);
  expect(await original.client.authorize(grant.token!, intent.workbenchId)).not.toBeNull();
  await original.close();
  await first.close();
  const reopened = fixture.owner();
  const restarted = startEnvironmentAuthority(implementation, reopened, {
    serviceSecret: original.config.serviceSecret,
    port: original.port,
  });
  try {
    expect(await original.client.authorize(grant.token!, intent.workbenchId)).not.toBeNull();
    await reopened.revoke({ accountId, requestId: "revoke", environmentId: intent.environmentId });
    expect(await original.client.authorize(grant.token!, intent.workbenchId)).toBeNull();
  } finally {
    await restarted.close();
    await reopened.close();
  }
});

test("the private endpoint advertises its allowed method without executing a check", async () => {
  const manager = fixture.owner();
  const boundary = startEnvironmentAuthority(implementation, manager);
  await manager.close();
  try {
    const response = await fetch(new URL("/internal/v1/environment-authority", boundary.url));
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
    await response.body?.cancel();
  } finally {
    await boundary.close();
  }
});

test("invalid handler settings cannot retain sensitive configuration objects", async () => {
  const manager = fixture.owner();
  const marker = `private-${crypto.randomUUID()}`;
  try {
    let error: unknown;
    try {
      implementation.createEnvironmentAuthorityHandler(manager, { serviceSecret: { marker } } as never);
    } catch (reason) {
      error = reason;
    }
    expect(error).toBeInstanceOf(Error);
    expect(Bun.inspect(error, { depth: Infinity })).not.toContain(marker);
  } finally {
    await manager.close();
  }
});

test("Bearer scheme casing and separator spaces preserve the exact service credential", async () => {
  const manager = fixture.owner();
  const boundary = startEnvironmentAuthority(implementation, manager);
  try {
    const accountId = await provisionAccount(manager);
    const intent = registration(accountId);
    const grant = await manager.register(intent);
    for (const scheme of ["bearer ", "bEaReR   "]) {
      const response = await fetch(new URL("/internal/v1/environment-authority", boundary.url), {
        method: "POST",
        headers: { authorization: `${scheme}${boundary.config.serviceSecret}`, "content-type": "application/json" },
        body: JSON.stringify({ token: grant.token, workbenchId: intent.workbenchId }),
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        identity: {
          accountId,
          workbenchId: intent.workbenchId,
          environmentId: intent.environmentId,
        },
      });
    }
    const wrong = await boundary.request(
      { token: grant.token, workbenchId: intent.workbenchId },
      boundary.config.serviceSecret.toUpperCase(),
    );
    expect(wrong.status).toBe(401);
    await wrong.body?.cancel();
  } finally {
    await boundary.close();
    await manager.close();
  }
});
