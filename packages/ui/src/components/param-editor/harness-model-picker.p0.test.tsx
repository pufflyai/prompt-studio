import { expect, test } from "bun:test";
import { HarnessModelPicker } from "./harness-model-picker";

test("the selected model leads the list so long model lists keep it visible", () => {
  const field = HarnessModelPicker({
    label: "Model",
    harnessId: "saved",
    model: "C",
    harnesses: [{ id: "saved", name: "Saved" }],
    models: [
      { id: "A", name: "A" },
      { id: "B", name: "B" },
      { id: "C", name: "C" },
    ],
    onHarnessChange: () => {},
    onModelChange: () => {},
  });
  expect(field.props.param.options.map((option: { id: string }) => option.id)).toEqual(["C", "A", "B"]);
});

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

test("each harness shows its own icon and falls back to the terminal icon", () => {
  const field = HarnessModelPicker({
    label: "Model",
    harnessId: "custom",
    harnesses: [
      { id: "custom", name: "Custom", icon: "data:image/svg+xml;base64,PHN2Zy8+" },
      { id: "plain", name: "Plain" },
    ],
    models: [],
    onHarnessChange: () => {},
    onModelChange: () => {},
  });
  expect(field.props.param.group.options.map((option: { icon?: string }) => option.icon)).toEqual([
    "data:image/svg+xml;base64,PHN2Zy8+",
    "Terminal",
  ]);
});
