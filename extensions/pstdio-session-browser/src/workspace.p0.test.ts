import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { act } from "./actions";
import { createDraftWorkspace, workspacePresentation } from "./workspace";

const values = {
  workspace: { providerId: "external.provider", params: { template: "small", nested: { flags: ["a"], active: true } } },
};

test("committed workspace creation is acknowledged even when optional metadata/harness reads fail", async () => {
  const creates: unknown[] = [];
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      account: { devices: async () => [] },
      workspaces: {
        create: async (input) => {
          creates.push(input);
          return { id: "created", name: "Created" };
        },
        list: async () => {
          throw new Error("Metadata unavailable");
        },
      },
      sessions: {
        getDraftHarnessCommands: async () => {
          throw new Error("Harness unavailable");
        },
      },
    },
  });
  const result = await act(ctx, {
    renderer: { rendererId: "sessions", resource: { type: "session-draft", id: "draft" } },
    draftKey: "draft",
    action: { type: "operation", id: "create-workspace", values },
  });
  expect(result).toEqual({ snapshot: { values: { workspace: "created" } } });
  expect(creates).toEqual([{ providerId: "external.provider", params: values.workspace.params }]);
});

test("creation errors retain provider inputs and a remote selection never creates on the local host", async () => {
  let creates = 0;
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      workspaces: {
        create: async () => {
          creates++;
          throw new Error("Provider validation failed");
        },
      },
      account: { devices: async () => [{ id: "laptop", name: "Laptop", online: true, current: false }] },
    },
  });
  await expect(createDraftWorkspace(ctx, values)).rejects.toThrow("Provider validation failed");
  expect(values.workspace.params.template).toBe("small");
  await expect(createDraftWorkspace(ctx, { ...values, device: "laptop" })).rejects.toThrow("owning device");
  expect(creates).toBe(1);
});

test("saved remote workspace hub keeps device identity while creation is locked", async () => {
  const ctx = makeCommandContext({ storage: createMemoryStorage(), params: {} });
  const binding = await workspacePresentation(
    ctx,
    { id: "remote", name: "Remote", device: { id: "laptop", ownerId: "owner", name: "Laptop" } },
    { id: "remote", locked: true, remote: true },
  );
  expect(binding.deviceControlId).toBe("device");
  expect(binding.create).toBeUndefined();
  expect(binding.openResourceId).toBe("remote");
});
