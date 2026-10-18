import { afterAll, beforeAll, expect, test } from "bun:test";
import { createAuthorityFixture, provisionAccount, registration } from "./authority.fixture";
import * as implementation from "./index";

const fixture = createAuthorityFixture(implementation);
const importedFixture = createAuthorityFixture(implementation);
beforeAll(async () => {
  await fixture.initialize();
  await importedFixture.initialize();
});
afterAll(() => Promise.all([fixture.close(), importedFixture.close()]));

test("restored receipt results stay within their account and workbench membership", async () => {
  const owner = fixture.owner();
  try {
    const accountId = await provisionAccount(owner);
    const otherAccountId = await provisionAccount(owner);
    const { token, ...grant } = await owner.register(registration(accountId, "register"));
    await owner.register({ ...registration(otherAccountId), workbenchId: "other-workbench" });
    const snapshot = await owner.snapshot();
    const changes = [
      { id: "provision", result: { accountId: otherAccountId } },
      { id: "register", result: { ...grant, accountId: otherAccountId } },
      { id: "register", result: { ...grant, workbenchId: "other-workbench" } },
    ];
    for (const [index, change] of changes.entries()) {
      const invalid = {
        ...snapshot,
        requests: snapshot.requests.map((row) =>
          row.accountId === accountId && row.id === change.id
            ? { ...row, id: `${row.id}-invalid`, result: change.result }
            : row,
        ),
      };
      await expect(owner.restore(`invalid-receipt-${index}`, invalid)).rejects.toThrow();
      expect(await owner.authorize(token!, grant.workbenchId)).not.toBeNull();
    }
  } finally {
    await owner.close();
  }
});

test("an older restore preserves newer request outcomes and cannot reactivate a later account", async () => {
  const owner = fixture.owner();
  try {
    const accountId = await provisionAccount(owner);
    const snapshot = await owner.snapshot();
    const intent = registration(accountId);
    const grant = await owner.register(intent);
    const laterAccountId = await provisionAccount(owner);
    await owner.reconcile({
      requestId: "new-owner-before-restore",
      accountId,
      owner: { issuer: "https://accounts.google.com", subject: "current-google-owner" },
      state: "active",
    });
    await owner.restore("retain-newer-requests", snapshot);
    expect(await owner.authorize(grant.token!, grant.workbenchId)).toBeNull();
    expect((await owner.snapshot()).accounts.find((row) => row.id === accountId)?.ownerSubject).toBe(
      "current-google-owner",
    );
    await owner.reconcile({
      requestId: "current-authority",
      accountId,
      owner: { issuer: "https://accounts.google.com", subject: "current-google-owner" },
      state: "active",
    });
    const retry = await owner.register(intent);
    expect(retry).toEqual({ ...grant, token: null });
    await expect(owner.register({ ...intent, environmentId: "changed" })).rejects.toThrow("changed intent");
    await owner.provision({
      requestId: "provision",
      accountId: laterAccountId,
      owner: { issuer: "https://accounts.google.com", subject: laterAccountId },
    });
    await expect(owner.register(registration(laterAccountId))).rejects.toThrow("not active");
    const current = await owner.snapshot();
    expect(current.requests.some((row) => row.accountId === accountId && row.id === intent.requestId)).toBe(true);
    await owner.restore("retained-history-snapshot", current);
  } finally {
    await owner.close();
  }
});

test("a fresh manager imports snapshot history while requiring new current authority", async () => {
  const owner = fixture.owner();
  const imported = importedFixture.owner();
  try {
    const accountId = await provisionAccount(owner);
    const intent = registration(accountId);
    const grant = await owner.register(intent);
    await imported.restore("import-history", await owner.snapshot());
    expect(await imported.authorize(grant.token!, grant.workbenchId)).toBeNull();
    expect(await imported.register(intent)).toEqual({ ...grant, token: null });
    await expect(imported.register(registration(accountId))).rejects.toThrow("not active");
    await imported.reconcile({
      requestId: "current-imported-authority",
      accountId,
      owner: { issuer: "https://accounts.google.com", subject: accountId },
      state: "active",
    });
    const fresh = await imported.register(registration(accountId));
    expect(await imported.authorize(fresh.token!, fresh.workbenchId)).not.toBeNull();
  } finally {
    await Promise.all([owner.close(), imported.close()]);
  }
});

test("a restored receipt cannot replace a known request fingerprint or result", async () => {
  const owner = fixture.owner();
  try {
    const accountId = await provisionAccount(owner);
    const grant = await owner.register(registration(accountId, "immutable"));
    const snapshot = await owner.snapshot();
    for (const field of ["fingerprint", "result"] as const) {
      const invalid = {
        ...snapshot,
        requests: snapshot.requests.map((row) => {
          if (row.accountId !== accountId || row.id !== "immutable") return row;
          if (field === "fingerprint") return { ...row, fingerprint: "0".repeat(64) };
          return { ...row, result: { ...row.result, id: "changed-grant" } };
        }),
      };
      await expect(owner.restore(`conflicting-${field}`, invalid)).rejects.toThrow();
      expect(await owner.authorize(grant.token!, grant.workbenchId)).not.toBeNull();
    }
  } finally {
    await owner.close();
  }
});
