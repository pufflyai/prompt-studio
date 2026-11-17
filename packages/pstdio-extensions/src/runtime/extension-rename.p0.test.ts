import { expect, test } from "bun:test";
import { defineCommand, defineHook, defineTemplateType, eventRef, params } from "@pstdio/sdk/extensions";
import type { LoadedExtensionSource } from "./loader";
import { normalizeExtensionSources } from "./normalize";
import { createCommandRunner } from "./runner";
import { makeStorage, stubEnvironment } from "./runner/runner.test-fixture";

const notes = (name = "notes"): LoadedExtensionSource => ({
  packagePath: "/fake/notes",
  sourcePath: "/fake/notes/extension.ts",
  sourceKind: "local_path",
  manifest: {
    id: `pstdio.${name}`,
    name,
    publisher: "pstdio",
    version: "1.0.0",
    main: "./extension.ts",
    enginesPstdio: "^0.4.0 || ^0.5.0",
  },
  definition: {
    commands: [defineCommand({ id: "notes.create", title: "New note", cli: true, run: () => ({ created: true }) })],
  },
});

test("old Notes sources and commands have canonical discovery with deprecated routes", () => {
  const runtime = normalizeExtensionSources([notes("pstdio-notes")]);
  expect(runtime.extensions.map((e) => e.id)).toEqual(["pstdio.notes"]);
  expect(runtime.commands.map((c) => c.id)).toEqual(["pstdio.notes.command.notes.create"]);
  expect(runtime.cli[0]?.pathKey).toBe("pstdio.notes create");
  expect(runtime.cli[0]?.deprecatedPaths).toContainEqual(["pstdio.pstdio-notes", "notes", "create"]);
});

test("historical command and lifecycle refs execute and deliver once", async () => {
  let delivered = 0;
  const source = notes();
  source.definition = {
    ...source.definition,
    hooks: [
      defineHook({
        id: "after-create",
        event: eventRef({ extensionId: "pstdio.pstdio-notes", id: "command.completed:notes.create" }),
        run: () => {
          delivered++;
        },
      }),
    ],
  };
  const runtime = normalizeExtensionSources([source]);
  const runner = createCommandRunner(runtime, { buildEnvironment: () => stubEnvironment(makeStorage().api) });
  const outcome = await runner.execute({ projectId: "p1", commandId: "pstdio.pstdio-notes.command.notes.create" });
  expect(outcome.ok).toBe(true);
  expect(delivered).toBe(1);
  expect((await runner.execute({ projectId: "p1", commandId: "alice.pstdio-notes.command.notes.create" })).ok).toBe(
    false,
  );
  const absent = createCommandRunner(normalizeExtensionSources([]), {
    buildEnvironment: () => stubEnvironment(makeStorage().api),
  });
  expect((await absent.execute({ projectId: "p1", commandId: "pstdio.pstdio-notes.command.notes.create" })).ok).toBe(
    false,
  );
});

test("a legacy emitter refreshes canonical consumers once even without any hooks", async () => {
  const source = notes("pstdio-notes");
  const changed = { kind: "event" as const, extensionId: "pstdio.pstdio-notes", id: "notes.changed" };
  source.definition = {
    commands: [
      defineCommand({
        id: "notes.create",
        title: "New note",
        run: async (ctx) => {
          await ctx.events.emit(changed, {});
        },
      }),
    ],
    views: [
      {
        id: "reader",
        ref: { kind: "view", id: "reader" },
        title: "Reader",
        body: { kind: "controls", refreshEvents: [changed], query: async () => ({ fields: [], values: {} }) },
      },
    ],
  };
  const runtime = normalizeExtensionSources([source]);
  const events: string[] = [];
  const runner = createCommandRunner(runtime, {
    buildEnvironment: () => stubEnvironment(makeStorage().api),
    onDidDispatchEvent: (id) => {
      events.push(id);
    },
  });
  expect((await runner.execute({ projectId: "p1", commandId: "pstdio.notes.command.notes.create" })).ok).toBe(true);
  expect(events.filter((id) => id.includes("notes.changed"))).toEqual(["pstdio.notes.event.notes.changed"]);
  events.length = 0;
  await runner.dispatchEvent({ projectId: "p1", eventId: "pstdio.pstdio-notes.event.notes.changed" });
  expect(events).toEqual(["pstdio.notes.event.notes.changed"]);
});

test("a qualified historical template type still offers templates from its enabled provider", () => {
  const source = notes("pstdio-notes");
  source.definition = {
    templateTypes: [defineTemplateType({ id: "note", label: "Note" })],
    commands: [
      defineCommand({
        id: "make",
        title: "Make",
        params: { template: params.template({ type: "pstdio.pstdio-notes.template-type.note" }) },
        run() {},
      }),
    ],
  };
  const runtime = normalizeExtensionSources([source]);
  expect(runtime.commands[0]?.params.template).toMatchObject({ templateType: "pstdio.notes.template-type.note" });
});
