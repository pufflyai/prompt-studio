import { expect, test } from "bun:test";
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
      enableInstalledSourceForProject: async (_input: { projectId: string }) => {
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
    await service.enableInstalledSourceForProject({ projectId: "project" });
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
