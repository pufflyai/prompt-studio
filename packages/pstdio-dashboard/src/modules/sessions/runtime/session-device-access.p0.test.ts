import { expect, test } from "bun:test";
import type { AccountDevice } from "pstdio-api-contracts";
import { resolveDeviceWorkspaceSelection, sessionDeviceAccess } from "./session-device-access";

const laptop: AccountDevice = {
  id: "laptop",
  name: "Laptop",
  current: false,
  online: true,
  platform: "macos",
  createdAt: "",
  lastSeenAt: "",
};
const owner = { id: "laptop", name: "Laptop", ownerId: "account" };

test("online owner permits the normal composer without moving existing ownership", () => {
  const access = sessionDeviceAccess(owner, "different-selection", [laptop]);
  expect(access.deviceId).toBe("laptop");
  expect(access.unavailable).toBe(false);
});

test("missing or offline ownership keeps history readable and disables actions", () => {
  expect(sessionDeviceAccess(owner, "this-device", []).unavailable).toBe(true);
  expect(sessionDeviceAccess(owner, "this-device", [{ ...laptop, online: false }]).unavailable).toBe(true);
});

test("new sessions target only the selected online device; local sessions need no account", () => {
  expect(sessionDeviceAccess(undefined, "laptop", [laptop])).toMatchObject({
    deviceId: "laptop",
    unavailable: false,
    remote: true,
  });
  expect(sessionDeviceAccess(undefined, "laptop", []).unavailable).toBe(true);
  expect(sessionDeviceAccess(undefined, "this-device", [])).toMatchObject({
    deviceId: undefined,
    unavailable: false,
    remote: false,
  });
});

test("a draft switching devices never sends a source workspace as the target fallback", () => {
  expect(resolveDeviceWorkspaceSelection([], "source-workspace", "source-workspace")).toBe("");
  expect(
    resolveDeviceWorkspaceSelection(
      [{ id: "target-default", isDefault: true }],
      "source-workspace",
      "source-workspace",
    ),
  ).toBe("target-default");
});
