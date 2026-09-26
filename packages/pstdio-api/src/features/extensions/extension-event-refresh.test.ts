import { expect, test } from "bun:test";
import type { EventContext } from "pstdio-api-contracts/extension-kernel";
import { EventBus } from "../sync/event-bus";
import { fireExtensionEvent } from "./extension-event-runtime";

test("publishes host events to views before waiting for hooks", async () => {
  const eventBus = new EventBus();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const eventId = "example.worker.event.automation-run-changed";
  const dispatch = fireExtensionEvent(
    {
      eventBus,
      repoService: { listByProject: async () => [] },
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
            extensions: [{ id: "example.worker" }],
            hooks: [
              {
                id: "hook",
                extensionId: "example.worker",
                name: "worker",
                eventId,
                handler: async (ctx: EventContext) => {
                  entered.resolve();
                  await release.promise;
                  await ctx.events.emit({ kind: "event", id: "refreshed" }, {});
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
  );
  try {
    await entered.promise;
    expect(eventBus.getSince(0)).toMatchObject([
      { table: "extension_events", data: { projectId: "project", eventId } },
    ]);
  } finally {
    release.resolve();
    await dispatch;
  }
  expect(eventBus.getSince(0).map((event) => event.data)).toMatchObject([
    { projectId: "project", eventId },
    { projectId: "project", eventId: "example.worker.event.refreshed" },
  ]);
});
