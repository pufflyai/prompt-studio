import { expect, test } from "bun:test";
import { assertCurrentNativeAction } from "./native-action-state";

const mode = {
  id: "objective",
  label: "Objective",
  description: "Ship",
  state: "active",
  actions: [{ id: "clear", label: "Clear current objective" }],
};
const operation = { kind: "mode-action" as const, modeId: "objective", actionId: "clear" };
test("native actions require a fresh matching objective and advertised action", () => {
  expect(() => assertCurrentNativeAction([mode], [mode], operation)).not.toThrow();
  expect(() => assertCurrentNativeAction([mode], [{ ...mode, description: "Replacement" }], operation)).toThrow();
  expect(() => assertCurrentNativeAction([mode], [{ ...mode, actions: [] }], operation)).toThrow();
  expect(() => assertCurrentNativeAction([mode], [], operation)).toThrow();
});
