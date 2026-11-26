import { expect, test } from "bun:test";
import { AsyncResource } from "node:async_hooks";
import { withProjectExtensionChoices } from "../features/extensions/project-extension-choices";
import { serializeExtensionChoices } from "./extension-choice-service";

test("source discovery, local toggles and shared adoption wait for the whole project handoff", async () => {
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const calls: string[] = [];
  const service = serializeExtensionChoices(
    {
      setProjectExtensionEnabled: async (_id: string, _enabled: boolean) => {
        calls.push("toggle");
      },
      enableInstalledSourceForProject: async (
        _input: { projectId: string },
        options?: { expectedProvider: string },
      ) => {
        expect(options).toEqual({ expectedProvider: "old-instance" });
        calls.push("enable");
      },
      syncInstalledSourceForProject: async (_input: { projectId: string }) => {
        calls.push("discovery");
      },
      activatePublishedExtensions: async (_inputs: Array<{ projectId: string }>) => {
        calls.push("adopt");
      },
    },
    async () => "project",
  );
  const handoff = withProjectExtensionChoices(service, "project", async () => {
    await service.enableInstalledSourceForProject({ projectId: "project" }, { expectedProvider: "old-instance" });
    started.resolve();
    await release.promise;
    calls.push("handoff");
  });
  await started.promise;
  const toggle = service.setProjectExtensionEnabled("old-instance", false);
  const discovery = service.syncInstalledSourceForProject({ projectId: "project" });
  const adopt = service.activatePublishedExtensions([{ projectId: "project" }]);
  await Promise.resolve();
  expect(calls).toEqual(["enable"]);
  release.resolve();
  await Promise.all([handoff, toggle, discovery, adopt]);
  expect(calls[1]).toBe("handoff");
  expect(calls.slice(2).sort()).toEqual(["adopt", "discovery", "toggle"]);
});

test("a completed handoff cannot leave background callbacks holding its choice lease", async () => {
  const calls: string[] = [];
  const service = serializeExtensionChoices(
    {
      setProjectExtensionEnabled: async () => {
        calls.push("background");
      },
    },
    async () => "project",
  );
  let background!: () => Promise<void>;
  await withProjectExtensionChoices(service, "project", async () => {
    background = AsyncResource.bind(() => service.setProjectExtensionEnabled());
  });
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const newerChoice = withProjectExtensionChoices(service, "project", async () => {
    started.resolve();
    await release.promise;
    calls.push("newer");
  });
  await started.promise;
  const pending = background();
  try {
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(calls).toEqual([]);
  } finally {
    release.resolve();
    await Promise.all([newerChoice, pending]);
  }
  expect(calls).toEqual(["newer", "background"]);
});
