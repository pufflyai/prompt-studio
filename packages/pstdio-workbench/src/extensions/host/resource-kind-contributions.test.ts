import { expect, test } from "bun:test";
import { createWorkbench } from "../../core";
import { emptyWorkbenchExtensionMetadata } from "../contributions/extension-contributions";
import { registerWorkbenchExtensionContributions } from "./workbench-extension-host";

const source = { type: "note", id: "one", extensionId: "example.notes", projectId: "project" };
const setup = (value: unknown) => {
  const workbench = createWorkbench();
  const calls: unknown[] = [];
  const registration = registerWorkbenchExtensionContributions({
    workbench,
    projectId: "project",
    executeCommand: (commandId, body, signal) => {
      calls.push({ commandId, body, signal });
      return { outcome: { status: "success", value, navigationRequests: [{ kind: "href", href: "/ignored" }] } };
    },
    metadata: {
      ...emptyWorkbenchExtensionMetadata,
      resourceKinds: [
        {
          id: "note",
          localId: "note",
          extensionId: "example.notes",
          relatedOpeningsCommand: "example.notes.command.related",
        },
      ],
    },
  });
  const resolve = (signal = new AbortController().signal) =>
    workbench.resources.getKind("note")!.relatedOpenings!(source, signal);
  return { workbench, registration, calls, resolve };
};
test("resource kind metadata runs its owner command with source context and qualifies returned references", async () => {
  const s = setup([{ resource: { type: "note", id: "two" }, autoOpen: true, region: "side" }]);
  const controller = new AbortController();
  expect(await s.resolve(controller.signal)).toEqual([
    {
      resource: { type: "note", id: "two", extensionId: "example.notes", projectId: "project" },
      autoOpen: true,
      region: "side",
    },
  ]);
  expect(s.calls).toEqual([
    {
      commandId: "example.notes.command.related",
      body: { projectId: "project", resource: source, source: "dashboard" },
      signal: controller.signal,
    },
  ]);
  expect(s.workbench.pages.store.getState().location).toBeUndefined();
  s.registration.dispose();
  expect(s.workbench.resources.getKind("note")).toBeUndefined();
});
test("related opening results reject malformed resources, regions, and opt-in values", async () => {
  for (const value of [
    [{ resource: { id: "two" }, region: "side" }],
    [{ resource: source, region: "overlay" }],
    [{ resource: source, region: "side", autoOpen: "true" }],
  ]) {
    const s = setup(value);
    expect(
      await Promise.resolve(s.resolve()).then(
        () => false,
        () => true,
      ),
    ).toBe(true);
    s.registration.dispose();
  }
});
