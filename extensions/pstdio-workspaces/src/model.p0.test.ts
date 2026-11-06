import { expect, test } from "bun:test";
import { groupDevices, workspaceResource, workspaceTarget } from "./model";

test("device groups put this device first, then online names, then offline last seen", () => {
  const devices = [
    { id: "old", name: "Old", online: false, current: false, lastSeenAt: "2026-10-01" },
    { id: "b", name: "Zebra", online: true, current: false, lastSeenAt: "2026-11-04" },
    { id: "a", name: "Alpha", online: true, current: false, lastSeenAt: "2026-11-04" },
    { id: "new", name: "Recent", online: false, current: false, lastSeenAt: "2026-11-01" },
    { id: "local", name: "Here", online: true, current: true, lastSeenAt: "2026-11-04" },
  ];
  expect(groupDevices(devices).map((device) => device.id)).toEqual(["local", "a", "b", "new", "old"]);
});
test("project Files omit Changes and foreign workspace navigation opens history only", () => {
  const local = {
    id: "one",
    name: "Project",
    isDefault: true,
    executionKind: "local" as const,
    providerState: "ready" as const,
    capabilities: { files: "write" as const, diff: false, merge: false, rebase: false, delete: false },
  };
  expect(workspaceTarget(local, "project").page.id).toBe("files");
  const foreign = { ...local, isDefault: false, device: { ownerId: "owner", id: "other", name: "Other" } };
  expect(workspaceTarget(foreign, "project").page.id).toBe("history");
  expect(workspaceResource(foreign, "project").metadata).toMatchObject({
    workspaceReadOnly: true,
    workspaceSupportsFiles: false,
    workspaceSupportsDiff: false,
  });
  expect(
    workspaceTarget({ ...local, isDefault: false, capabilities: { ...local.capabilities!, diff: true } }, "project")
      .page.id,
  ).toBe("workspace");
});
