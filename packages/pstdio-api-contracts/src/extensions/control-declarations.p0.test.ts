import { expect, test } from "bun:test";
import type { ControlsQueryResult } from "../extension-kernel";
import { supportedControls } from "./control-declaration-fixtures";
import { controlsQueryResultSchema } from "./control-declarations";

test("round-trips a native harness control and its model options", () => {
  const agent = {
    harnessId: "pstdio.harness-codex.harness.codex",
    model: "gpt-6-astra",
    params: { effort: "high", fast: false },
  };
  const result = {
    params: [{ id: "agent", name: "Model", type: "harness" as const, defaultValue: agent }],
    values: { agent },
  };
  expect(controlsQueryResultSchema.parse(result)).toEqual(result);
});

test.each(Object.values(supportedControls))("round-trips supported controls: $type", (control) => {
  expect(controlsQueryResultSchema.parse(JSON.parse(JSON.stringify({ params: [control] })))).toEqual({
    params: [control],
  });
});

test("accepts serializable controls and groups", () => {
  const result: ControlsQueryResult = {
    groups: [
      {
        id: "details",
        title: "Details",
        params: [
          { id: "title", name: "Title", type: "text", defaultValue: "" },
          { id: "position", name: "Position", type: "vector", defaultValue: { x: 2, y: 3 } },
          {
            id: "status",
            name: "Status",
            type: "selection",
            defaultValue: "new",
            options: [{ id: "new", name: "New" }],
          },
        ],
      },
    ],
    values: { title: "Notes", position: { x: 10, y: 20 } },
  };
  expect(controlsQueryResultSchema.parse(result)).toEqual(result);
});

test.each([
  { type: "number", defaultValue: "two" },
  { type: "selection", defaultValue: "new", options: ["new"] },
  { type: "property", value: "React nodes belong to the UI API" },
  { type: "fileUpload", defaultValue: [] },
  { type: "boolean", defaultValue: true, readOnlly: true },
])("rejects invalid controls at their field path: %j", (field) => {
  const result = controlsQueryResultSchema.safeParse({
    groups: [{ id: "details", title: "Details", params: [{ id: "value", name: "Value", ...field }] }],
  });
  expect(result.success).toBe(false);
  if (!result.success) expect(result.error.issues[0]?.path.slice(0, 4)).toEqual(["groups", 0, "params", 0]);
});

test("native harness controls preserve an unselected picker before a harness is chosen", () => {
  const result = {
    params: [{ id: "harness", name: "Harness", type: "harness" as const, defaultValue: { harnessId: "" } }],
    values: { harness: { harnessId: "" } },
  };
  expect(controlsQueryResultSchema.parse(result)).toEqual(result);
});

test("numeric controls retain the boolean control that enables input", () => {
  const result = {
    params: [{ id: "count", name: "Count", type: "number" as const, defaultValue: 6, enabledBy: "limited" }],
  };
  expect(controlsQueryResultSchema.parse(result)).toEqual(result);
});
