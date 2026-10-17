import { afterAll, beforeAll, expect, test } from "bun:test";
import { createAuthorityFixture, provisionAccount } from "./authority.fixture";
import * as implementation from "./index";

const fixture = createAuthorityFixture(implementation);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("restores receipt history larger than one PostgreSQL parameter batch", async () => {
  const owner = fixture.owner();
  try {
    const accountId = await provisionAccount(owner);
    const snapshot = await owner.snapshot();
    const requests = Array.from({ length: 16_384 }, (_, index) => ({
      accountId,
      id: `retained-${index}`,
      fingerprint: "a".repeat(64),
      result: {},
    }));
    await owner.restore("large-history", { ...snapshot, requests: [...snapshot.requests, ...requests] });
    const restored = await owner.snapshot();
    expect(restored.requests.filter((row) => row.accountId === accountId)).toHaveLength(requests.length + 1);
    expect(restored.accounts.find((row) => row.id === accountId)?.state).toBe("disabled");
  } finally {
    await owner.close();
  }
});
