import { expect, test } from "bun:test";
import { type LocalRelayConnection, localGrantNeedsEnrollment, upsertLocalRelayConnection } from "./relay-local-config";

test("renewing the fixture grant preserves other shared workbench and extension connections", () => {
  const original: LocalRelayConnection = {
    accountId: "account",
    workbenchId: "fixture",
    extensionId: "demo",
    environmentId: "environment",
    managerOrigin: "https://authority:8443",
    relayOrigin: "https://relay:8080",
    renewalGrant: "expired",
  };
  const notes = {
    ...original,
    workbenchId: "actual-user-workbench",
    extensionId: "notes",
    renewalGrant: "notes-secret",
  };
  const replacement = { ...original, renewalGrant: "renewed" };
  expect(upsertLocalRelayConnection([notes, original], replacement)).toEqual([notes, replacement]);
  expect(upsertLocalRelayConnection([notes], replacement)).toEqual([notes, replacement]);
  expect(localGrantNeedsEnrollment(200)).toBe(false);
  expect(localGrantNeedsEnrollment(401)).toBe(true);
  expect(() => localGrantNeedsEnrollment(503)).toThrow("unavailable");
});
