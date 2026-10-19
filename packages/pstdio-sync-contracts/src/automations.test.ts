import { expect, test } from "bun:test";
import { automationDefinitionId, validateAutomationRecord } from "./automations";
import type { StoredRecord } from "./state";

const definition = {
  kind: "definition",
  scheduleId: "clock.schedule.tick",
  extensionId: "clock",
  target: { environmentId: "target", workbenchId: "workbench", workspaceId: "workspace" },
  enabled: true,
  startsAt: "2026-10-19T09:00:00.000Z",
};
const record: StoredRecord = {
  recordId: automationDefinitionId(definition.scheduleId),
  revision: 1,
  deleted: false,
  primitive: null,
  map: {},
  value: definition,
  asset: null,
};
test("automation targets are immutable and only the owning environment can first assign them", () => {
  expect(() => validateAutomationRecord(record, undefined, "elsewhere", "workbench")).toThrow();
  expect(() => validateAutomationRecord(record, undefined, "target", "workbench")).not.toThrow();
  expect(() =>
    validateAutomationRecord({ ...record, value: { ...definition, enabled: false } }, record, "elsewhere", "workbench"),
  ).not.toThrow();
  expect(() =>
    validateAutomationRecord(
      { ...record, value: { ...definition, target: { ...definition.target, environmentId: "elsewhere" } } },
      record,
      "elsewhere",
      "workbench",
    ),
  ).toThrow();
  expect(() => validateAutomationRecord({ ...record, deleted: true }, record, "target", "workbench")).toThrow();
});
