import { expect, test } from "bun:test";
import { normalizeExtensionSources } from "pstdio-extensions";
import { createMemoryDocumentStore } from "pstdio-sync";
import { createDocumentStorage } from "pstdio-sync/records";
import type { ExtensionsRouteDeps } from "./deps";
import {
  assignDeviceAutomation,
  listDeviceAutomations,
  readDeviceAutomation,
  setDeviceAutomationEnabled,
} from "./device-automations";
import { isAutomationEnabled } from "./extension-automations";
import { automationRunId, createAutomationRunJournal } from "./extension-schedule-admission/runs";

const old = "pstdio.pstdio-notes.schedule.tick";
const current = "pstdio.notes.schedule.tick";
const fixture = () => {
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
        enginesPstdio: "^0.4.0 || ^0.5.0",
      },
      definition: {
        commands: [{ id: "tick", ref: { kind: "command", id: "tick" }, title: "Tick", run() {} }],
        schedules: [
          {
            id: "tick",
            ref: { kind: "schedule", id: "tick" },
            title: "Tick",
            schedule: "* * * * *",
            command: { kind: "command", id: "tick" },
          },
        ],
      },
    },
  ]);
  const storage = createDocumentStorage({
    owner: { workbenchId: "project", extensionId: "pstdio.automations" },
    store: createMemoryDocumentStore(),
  });
  const preferences = [{ extension_instance_id: "instance", automation_id: old, enabled: true }];
  const deps = {
    extensionStorageService: { open: async () => storage },
    extensionRuntimeCatalog: {
      get: async () => ({
        runtime,
        enabledSources: [{ instance: { id: "instance" }, installedSource: { extension_id: "pstdio.notes" } }],
      }),
    },
    extensionAutomationPreferencesService: {
      list: async () => preferences,
      set: async (input: (typeof preferences)[number]) => {
        const previous = preferences.find((p) => p.automation_id === input.automation_id);
        if (previous) Object.assign(previous, input);
        else preferences.push(input);
        return input;
      },
    },
  } as unknown as ExtensionsRouteDeps;
  return { deps, storage, preferences, schedule: runtime.schedules[0]! };
};

test("toggling a historical schedule preference preserves its identity and disabled state", async () => {
  const f = fixture();
  await setDeviceAutomationEnabled(f.deps, "project", { scheduleId: current, instanceId: "instance", enabled: false });
  expect(f.preferences).toEqual([expect.objectContaining({ automation_id: old, enabled: false })]);
  expect(isAutomationEnabled(f.schedule, "instance", f.preferences)).toBe(false);
});

test.each([old, current])("existing assignment %s keeps its device and actual record key", async (recordId) => {
  const f = fixture();
  await f.storage.records.commit({
    operationId: "seed",
    edits: [
      {
        recordId,
        replace: { scheduleId: recordId, deviceId: "original", enabled: true, startsAt: "2026-11-01T00:00:00Z" },
      },
    ],
  });
  expect(await readDeviceAutomation(f.deps, "project", current)).toMatchObject({
    scheduleId: current,
    deviceId: "original",
  });
  await expect(assignDeviceAutomation(f.deps, "project", { scheduleId: current, deviceId: "other" })).rejects.toThrow(
    "assigned",
  );
  await setDeviceAutomationEnabled(f.deps, "project", { scheduleId: old, instanceId: "instance", enabled: false });
  expect((await f.storage.records.list()).map((r) => r.recordId)).toEqual([recordId]);
  expect(await listDeviceAutomations(f.deps, "project")).toEqual([
    expect.objectContaining({ scheduleId: current, deviceId: "original", enabled: false }),
  ]);
});

test("distinct assignment histories cannot silently choose a device", async () => {
  const f = fixture();
  await f.storage.records.commit({
    operationId: "seed",
    edits: [old, current].map((recordId) => ({
      recordId,
      replace: { scheduleId: recordId, deviceId: recordId, enabled: true, startsAt: "2026-11-01T00:00:00Z" },
    })),
  });
  await expect(readDeviceAutomation(f.deps, "project", current)).rejects.toThrow(/conflict/i);
  await expect(listDeviceAutomations(f.deps, "project")).rejects.toThrow(/conflict/i);
  expect(await f.storage.records.list()).toHaveLength(2);
});

test("historical occurrence claims and cursors cannot execute again after a schedule rename", async () => {
  const f = fixture();
  const scheduledFor = "2026-11-01T00:01:00Z";
  const recordId = automationRunId("project", old, scheduledFor);
  await f.storage.records.commit({
    operationId: "prior-claim",
    edits: [
      {
        recordId,
        replace: { runId: recordId, scheduleId: old, scheduledFor, deviceId: "original", status: "completed" },
      },
      { recordId: JSON.stringify(["cursor", old]), replace: scheduledFor },
    ],
  });
  expect(
    await createAutomationRunJournal(f.deps, "project").claim(
      { scheduleId: current, deviceId: "original", enabled: true, startsAt: "2026-11-01T00:00:00Z" },
      "* * * * *",
      new Date(scheduledFor),
    ),
  ).toBeNull();
  expect(await f.storage.records.list()).toHaveLength(2);
});
