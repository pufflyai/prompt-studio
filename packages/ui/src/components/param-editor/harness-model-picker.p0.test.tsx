import { expect, test } from "bun:test";
import { HarnessModelPicker } from "./harness-model-picker";

test("locking an existing harness keeps model selection enabled", () => {
  const changes: string[] = [];
  const field = HarnessModelPicker({
    label: "Model",
    harnessId: "saved",
    model: "A",
    lockHarness: true,
    harnesses: [
      { id: "saved", name: "Saved" },
      { id: "other", name: "Other" },
    ],
    models: [
      { id: "A", name: "A" },
      { id: "B", name: "B" },
    ],
    onHarnessChange: (id) => {
      changes.push(`harness:${id}`);
    },
    onModelChange: (id) => {
      changes.push(`model:${id}`);
    },
  });
  expect(field.props.param.group.disabled).toBe(true);
  expect(field.props.param.disabled).toBeFalsy();
  field.props.onChange("model", "B");
  expect(changes).toEqual(["model:B"]);
});
