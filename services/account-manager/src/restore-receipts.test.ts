import { afterAll, beforeAll, expect, test } from "bun:test";
import { connectDevice, createAuthorityFixture, deviceProfile, provisionAccount } from "./authority.fixture";
import * as implementation from "./index";

const fixture = createAuthorityFixture(implementation);
const importedFixture = createAuthorityFixture(implementation);
beforeAll(async () => {
  await fixture.initialize();
  await importedFixture.initialize();
});
afterAll(() => Promise.all([fixture.close(), importedFixture.close()]));

test("restored receipt results stay within their account", async () => {
  const owner = fixture.owner();
  try {
    const accountId = await provisionAccount(owner);
    const otherAccountId = await provisionAccount(owner);
    const device = await connectDevice(owner, accountId);
    const snapshot = await owner.snapshot();
    const invalid = {
      ...snapshot,
      requests: snapshot.requests.map((row) =>
        row.accountId === accountId && row.id === "provision"
          ? { ...row, id: "provision-invalid", result: { accountId: otherAccountId } }
          : row,
      ),
    };
    await expect(owner.restore("invalid-receipt", invalid)).rejects.toThrow();
    expect(await owner.authorize(device.token, device.workbenchId)).not.toBeNull();
  } finally {
    await owner.close();
  }
});

test("an older restore preserves newer request outcomes and cannot reactivate a later account", async () => {
  const owner = fixture.owner();
  try {
    const accountId = await provisionAccount(owner);
    const snapshot = await owner.snapshot();
    const device = await connectDevice(owner, accountId);
    const laterAccountId = await provisionAccount(owner);
    await owner.reconcile({
      requestId: "new-owner-before-restore",
      accountId,
      owner: { issuer: "https://accounts.google.com", subject: "current-google-owner" },
      state: "active",
    });
    await owner.restore("retain-newer-requests", snapshot);
    expect(await owner.authorize(device.token, device.workbenchId)).toBeNull();
    expect((await owner.snapshot()).accounts.find((row) => row.id === accountId)?.ownerSubject).toBe(
      "current-google-owner",
    );
    await owner.provision({
      requestId: "provision",
      accountId: laterAccountId,
      owner: { issuer: "https://accounts.google.com", subject: laterAccountId },
    });
    await expect(owner.registerDevice({ accountId: laterAccountId, ...deviceProfile() })).rejects.toThrow(
      "Device access",
    );
    const current = await owner.snapshot();
    expect(current.requests.some((row) => row.accountId === accountId && row.id === "new-owner-before-restore")).toBe(
      true,
    );
    await owner.restore("retained-history-snapshot", current);
  } finally {
    await owner.close();
  }
});

test("a fresh manager imports snapshot history while requiring new device logins", async () => {
  const owner = fixture.owner();
  const imported = importedFixture.owner();
  try {
    const accountId = await provisionAccount(owner);
    const device = await connectDevice(owner, accountId);
    await imported.restore("import-history", await owner.snapshot());
    expect(await imported.authorize(device.token, device.workbenchId)).toBeNull();
    await expect(imported.registerDevice({ accountId, ...deviceProfile() })).rejects.toThrow("Device access");
    await imported.reconcile({
      requestId: "current-imported-authority",
      accountId,
      owner: { issuer: "https://accounts.google.com", subject: accountId },
      state: "active",
    });
    const fresh = await imported.registerDevice({ accountId, ...deviceProfile(device.deviceId) });
    expect(await imported.authorize(fresh.token, device.workbenchId)).not.toBeNull();
  } finally {
    await Promise.all([owner.close(), imported.close()]);
  }
});

test("a restored receipt cannot replace a known request fingerprint or result", async () => {
  const owner = fixture.owner();
  try {
    const accountId = await provisionAccount(owner);
    const device = await connectDevice(owner, accountId);
    const snapshot = await owner.snapshot();
    for (const field of ["fingerprint", "result"] as const) {
      const invalid = {
        ...snapshot,
        requests: snapshot.requests.map((row) => {
          if (row.accountId !== accountId || row.id !== "provision") return row;
          if (field === "fingerprint") return { ...row, fingerprint: "0".repeat(64) };
          return { ...row, result: {} };
        }),
      };
      await expect(owner.restore(`conflicting-${field}`, invalid)).rejects.toThrow("known request outcome");
      expect(await owner.authorize(device.token, device.workbenchId)).not.toBeNull();
    }
  } finally {
    await owner.close();
  }
});
