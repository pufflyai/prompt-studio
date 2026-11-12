import { expect, test } from "bun:test";
import { defineHook } from "@pstdio/sdk/extensions";
import type { EventContext } from "pstdio-api-contracts/extension-kernel";
import { normalizeExtensionSources } from "pstdio-extensions";
import { EventBus } from "../sync/event-bus";
import { fireExtensionEvent } from "./extension-event-runtime";

test.each([true, false])("publishes nested refresh events while initial broadcast is %s", async (broadcast) => {
  const eventBus = new EventBus();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const eventId = "example.worker.event.automation-run-changed";
  const dispatch = fireExtensionEvent(
    {
      eventBus,
      workspaceService: { getDefault: async () => null },
      extensionRuntimeCatalog: {
        get: async () => ({
          enabledSources: [
            {
              instance: { id: "instance" },
              installedSource: { id: "source", extension_id: "example.worker", source_path: "/tmp/worker" },
            },
          ],
          project: { id: "project", name: "Project", shorthand: "P" },
          runtime: {
            ...normalizeExtensionSources([]),
            extensions: [{ id: "example.worker", definition: {} }],
            hooks: [
              {
                id: "hook",
                extensionId: "example.worker",
                name: "worker",
                eventId,
                handler: async (ctx: EventContext) => {
                  entered.resolve();
                  await release.promise;
                  await ctx.events.emit({ kind: "event", id: "refreshed" }, {}, { refresh: { resourceIds: ["item"] } });
                },
              },
            ],
            artifactMounts: [],
            settings: [],
          },
        }),
      },
    } as never,
    "project",
    eventId,
    { status: "succeeded" },
    undefined,
    undefined,
    { broadcast },
  );
  try {
    await entered.promise;
    expect(eventBus.getSince(0)).toMatchObject(
      broadcast ? [{ table: "extension_events", data: { projectId: "project", eventId } }] : [],
    );
  } finally {
    release.resolve();
    await dispatch;
  }
  expect(eventBus.getSince(0).map((event) => event.data)).toMatchObject([
    ...(broadcast ? [{ projectId: "project", eventId }] : []),
    { projectId: "project", eventId: "example.worker.event.refreshed", resourceIds: ["item"] },
  ]);
});

test("broadcast false suppresses historical notices as well as canonical notices", async () => {
  const eventBus = new EventBus();
  let calls = 0;
  const runtime = normalizeExtensionSources([
    {
      packagePath: "/notes",
      sourcePath: "/notes/extension.ts",
      sourceKind: "local_path",
      manifest: {
        id: "pstdio.notes",
        publisher: "pstdio",
        name: "notes",
        version: "1.0.0",
        main: "extension.ts",
        enginesPstdio: "^0.4.0",
      },
      definition: {
        hooks: [
          defineHook({
            id: "observe",
            event: { kind: "event", extensionId: "pstdio.pstdio-notes", id: "changed" },
            run: () => {
              calls++;
            },
          }),
        ],
      },
    },
  ]);
  await fireExtensionEvent(
    {
      eventBus,
      workspaceService: { getDefault: async () => null },
      extensionRuntimeCatalog: {
        get: async () => ({
          runtime,
          enabledSources: [
            {
              instance: { id: "notes" },
              installedSource: { id: "notes", extension_id: "pstdio.notes", source_path: "/notes" },
            },
          ],
          project: { id: "project", name: "Project", shorthand: "P" },
        }),
      },
    } as never,
    "project",
    "pstdio.notes.event.changed",
    {},
    undefined,
    undefined,
    { broadcast: false },
  );
  expect(calls).toBe(1);
  expect(eventBus.getSince(0)).toEqual([]);
});
