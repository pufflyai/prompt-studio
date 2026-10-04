import { expect, test } from "bun:test";
import type { HarnessCommandState } from "pstdio-api-contracts";
import { assertSingleCommand, composerCommandProblem, taggedCommandOperation } from "./composer-command";

const command = {
  name: "/objective",
  description: "Native objective",
  composer: { label: "Objective", reservedArguments: ["stop"] },
};
const intent = { harnessId: "external", command };
const state: HarnessCommandState = { slashCommands: true, commands: [command], modes: [] };

test("tagged input submits one provider command without rewriting the objective", () => {
  expect(taggedCommandOperation(intent, "  Finish /plan.md\nthen test  ", "external", state, 0)).toEqual({
    kind: "command",
    text: "/objective Finish /plan.md\nthen test",
  });
});
test("a stale or incompatible intent stays blocked instead of sending an ordinary prompt", () => {
  expect(composerCommandProblem(intent, "other", state)).toBeTruthy();
  expect(composerCommandProblem(intent, "external", { ...state, commands: [] })).toBeTruthy();
  const disabled = { ...state, commands: [{ ...command, disabledReason: "Leave planning first." }] };
  expect(() => taggedCommandOperation(intent, "Finish", "external", disabled, 0)).toThrow("Leave planning first.");
});
test("native action words and attachments do not become tagged objectives", () => {
  expect(() => taggedCommandOperation(intent, "stop", "external", state, 0)).toThrow();
  expect(() => taggedCommandOperation(intent, "Finish", "external", state, 1)).toThrow();
});
test("typed native commands respect the advertised availability reason", () => {
  const disabled = { ...state, commands: [{ ...command, disabledReason: "Leave planning first." }] };
  expect(() => assertSingleCommand("/objective Ship", disabled)).toThrow("Leave planning first.");
  expect(() => assertSingleCommand("/objective Ship", state)).not.toThrow();
});
