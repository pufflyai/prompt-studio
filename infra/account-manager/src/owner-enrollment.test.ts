import { afterAll, beforeAll, expect, test } from "bun:test";
import { createAuthorityFixture } from "./authority.fixture";
import * as implementation from "./index";
import { createAuthenticationFixture } from "./manager-authentication.fixture";

const fixture = createAuthorityFixture(implementation);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("signed-in Google owners create their account, list workbenches, enroll and revoke without operator grants", async () => {
  const authentication = createAuthenticationFixture(fixture.databaseUrl);
  const handler = implementation.createManagerHandler(authentication.auth, authentication.config.origin);
  const owner = await authentication.login(`new-owner-${crypto.randomUUID()}`);
  const other = await authentication.login(`other-owner-${crypto.randomUUID()}`);
  const request = (path: string, headers: Headers, body?: unknown) =>
    handler(
      new Request(`${authentication.config.origin}${path}`, {
        method: body ? "POST" : "GET",
        headers: {
          ...Object.fromEntries(headers),
          origin: authentication.config.origin,
          "content-type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    );
  try {
    const created = await request("/v1/owner/accounts", owner.headers, {});
    expect(created.status).toBe(201);
    const account = (await created.json()) as { accountId: string };
    expect(await (await request("/v1/owner/accounts", owner.headers, {})).json()).toEqual(account);
    expect(await (await request("/v1/owner/accounts", owner.headers)).json()).toEqual([account]);
    const path = `/v1/accounts/${account.accountId}`;
    const input = {
      requestId: crypto.randomUUID(),
      workbenchId: crypto.randomUUID(),
      environmentId: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    const grant = (await (await request(`${path}/environments`, owner.headers, input)).json()) as { token: string };
    expect(grant.token).toBeString();
    expect(await (await request(`${path}/workbenches`, owner.headers)).json()).toEqual([
      { workbenchId: input.workbenchId },
    ]);
    expect((await request(`${path}/workbenches`, other.headers)).status).toBe(401);
    expect(
      (await request(`${path}/environments`, other.headers, { ...input, requestId: crypto.randomUUID() })).status,
    ).toBe(401);
    expect(
      (
        await request(`${path}/environments/revoke`, owner.headers, {
          requestId: crypto.randomUUID(),
          environmentId: input.environmentId,
        })
      ).status,
    ).toBe(200);
    const renewal = await handler(
      new Request(`${authentication.config.origin}/v1/environment-access`, {
        method: "POST",
        headers: { authorization: `Bearer ${grant.token}`, "content-type": "application/json" },
        body: JSON.stringify({ workbenchId: input.workbenchId }),
      }),
    );
    expect(renewal.status).toBe(401);
  } finally {
    await authentication.close();
  }
});
