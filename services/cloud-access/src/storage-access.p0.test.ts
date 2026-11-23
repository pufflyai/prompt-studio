import { expect, test } from "bun:test";
import { createStorageAccess } from "./storage-access";

test("storage credentials can sign only objects under their authorized principal and run lifetime", async () => {
  const signed: { method: string; object: string; expiresSeconds: number }[] = [];
  const deadline = Date.now() + 100_000;
  let active = true;
  const storage = createStorageAccess({
    issuer: "https://access.example.test",
    key: crypto.getRandomValues(new Uint8Array(32)),
    sign: async (input) => {
      signed.push(input);
      return `https://storage.googleapis.com/bucket/${input.object}`;
    },
  });
  const authorize = async (identity: { subject: string }) => {
    if (!active || identity.subject !== "vm-a") throw new Error("Access denied.");
    return { principalId: "principal-a", roles: ["runner"] as const, storageDeadline: deadline };
  };
  const token = await storage.issue(
    { subject: "vm-a", human: false, expiresAt: deadline, instance: undefined },
    "run-a",
    new Date(deadline).toISOString(),
  );
  const object = `logs/${crypto.randomUUID()}.log`;
  const request = (body: unknown, credential = token) =>
    new Request("https://access.example.test/v1/storage/url", {
      method: "POST",
      headers: { Authorization: `Bearer ${credential}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  await storage.handle(request({ method: "GET", object, expiresSeconds: 3600 }), authorize);
  expect(signed[0]!.object).toBe(`owners/principal-a/${object}`);
  expect(signed[0]!.expiresSeconds).toBeLessThanOrEqual(100);
  await expect(
    storage.handle(request({ method: "GET", object: `owners/principal-b/${object}`, expiresSeconds: 3600 }), authorize),
  ).rejects.toThrow();
  await expect(
    storage.handle(request({ method: "GET", object: "logs/../../private", expiresSeconds: 3600 }), authorize),
  ).rejects.toThrow();
  await expect(
    storage.handle(request({ method: "GET", object, expiresSeconds: 3600 }, "forged"), authorize),
  ).rejects.toThrow();
  active = false;
  await expect(storage.handle(request({ method: "GET", object, expiresSeconds: 3600 }), authorize)).rejects.toThrow();
  expect(signed).toHaveLength(1);
});

test("revoking a run while signing is in flight prevents delivery of a new URL", async () => {
  let finish!: () => void;
  let started!: () => void;
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  const waiting = new Promise<void>((resolve) => {
    finish = resolve;
  });
  let active = true;
  const deadline = Date.now() + 60_000;
  const storage = createStorageAccess({
    issuer: "https://access.example.test",
    key: crypto.getRandomValues(new Uint8Array(32)),
    sign: async () => {
      started();
      await waiting;
      return "https://storage.googleapis.com/private";
    },
  });
  const token = await storage.issue(
    { subject: "vm", human: false, expiresAt: deadline, instance: undefined },
    "run",
    new Date(deadline).toISOString(),
  );
  const pending = storage.handle(
    new Request("https://access.example.test/v1/storage/url", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ method: "GET", object: `logs/${crypto.randomUUID()}.log`, expiresSeconds: 30 }),
    }),
    async () => {
      if (!active) throw new Error("Revoked.");
      return { principalId: "principal", roles: ["runner"], storageDeadline: deadline };
    },
  );
  await entered;
  active = false;
  finish();
  await expect(pending).rejects.toThrow("Revoked.");
});
