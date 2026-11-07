import { expect, test } from "bun:test";
import { createWorkbench } from "../../core";
import {
  createResourceParamCommand,
  queryCommandResources,
  singleResourceCommandParam,
} from "./resource-command-params";

const ref = (owner: string) => ({
  type: "session",
  id: "shared",
  extensionId: owner,
  projectId: "project",
  device: { id: "laptop", name: "Laptop", ownerId: "me" },
});

test("resource arguments merge live providers by complete canonical identity without invoking their navigation", async () => {
  const w = createWorkbench();
  w.resources.registerProvider({
    id: "sync",
    kind: "session",
    list: () => [{ resource: { ...ref("a"), label: "Old" } }],
  });
  let activations = 0;
  w.commandPaletteResources.registerProvider({
    id: "live",
    title: "Sessions",
    resourceKind: "session",
    query: async ({ query, limit }) => {
      expect(query).toBe("saved");
      expect(limit).toBe(100);
      return ["a", "b"].map((owner) => ({
        id: owner,
        label: `Saved ${owner}`,
        resource: ref(owner),
        indicator: { icon: "circle-check", label: "Completed" },
        activate: () => {
          activations++;
        },
      }));
    },
  });
  const { resources: result, more } = await queryCommandResources(
    w,
    "session",
    "saved",
    100,
    new AbortController().signal,
  );
  expect(result).toHaveLength(2);
  expect(more).toBe(false);
  expect(result[0]).toMatchObject({ resource: { ...ref("a"), label: "Saved a" }, indicator: { label: "Completed" } });
  expect(result[1]?.resource).toMatchObject(ref("b"));
  expect(activations).toBe(0);
  await w.dispose();
});

test("an aborted resource read cannot deliver stale choices", async () => {
  const w = createWorkbench();
  let finish!: () => void;
  w.commandPaletteResources.registerProvider({
    id: "held",
    title: "Sessions",
    resourceKind: "session",
    query: async () => {
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      return [{ id: "a", label: "Saved", resource: ref("a"), activate: () => {} }];
    },
  });
  const controller = new AbortController();
  const result = queryCommandResources(w, "session", "", 100, controller.signal);
  controller.abort();
  finish();
  expect(await result).toEqual({ resources: [], more: false });
  await w.dispose();
});

test("selection executes the original command with its captured viewer and full reference", async () => {
  const w = createWorkbench();
  const context = {
    placement: { kind: "shell" as const, placementId: "side", instanceKey: "side" },
    resource: { type: "session", id: "source" },
    isViewerCurrent: () => true,
  };
  const request = {
    record: {
      command: {
        id: "switch",
        label: "Switch",
        params: { destination: { type: "resource" as const, resourceType: "session", required: true } },
      },
    },
    label: "Switch",
    args: { retained: "value" },
    context,
  };
  const calls: unknown[] = [];
  w.commands.registerCommand(request.record.command, {
    execute: (args, current) => {
      calls.push({ args, context: current });
    },
  });
  expect(singleResourceCommandParam(request)?.key).toBe("destination");
  await createResourceParamCommand(w, request).run("destination", ref("owner"));
  expect(calls).toEqual([{ args: { retained: "value", destination: ref("owner") }, context }]);
  expect(
    singleResourceCommandParam({
      ...request,
      record: {
        command: { ...request.record.command, params: { ...request.record.command.params, text: { type: "text" } } },
      },
    }),
  ).toBeUndefined();
  await w.dispose();
});

test("untyped resource descriptors keep their existing form", () => {
  expect(
    singleResourceCommandParam({
      label: "Select",
      record: {
        command: { id: "select", label: "Select", params: { resource: { type: "resource", required: true } } },
      },
    }),
  ).toBeUndefined();
});

test("a resource request prevents duplicate held dispatch and allows a failed selection to retry", async () => {
  const w = createWorkbench();
  let calls = 0;
  let reject!: (error: Error) => void;
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  w.commands.registerCommand(
    { id: "select", label: "Select" },
    {
      execute: () => {
        calls++;
        entered();
        return calls === 1
          ? new Promise<void>((_resolve, fail) => {
              reject = fail;
            })
          : Promise.resolve();
      },
    },
  );
  const request = { label: "Select", record: { command: { id: "select", label: "Select" } } };
  const execution = createResourceParamCommand(w, request);
  const first = execution.run("resource", ref("a"));
  const second = execution.run("resource", ref("b"));
  await started;
  expect(second).toBe(first);
  expect(calls).toBe(1);
  expect(execution.pending).toBe(true);
  reject(new Error("Unavailable"));
  await expect(first).rejects.toThrow("Unavailable");
  expect(execution.pending).toBe(false);
  await execution.run("resource", ref("a"));
  expect(calls).toBe(2);
  await w.dispose();
});
