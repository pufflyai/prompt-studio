import { expect, test } from "bun:test";
import type { ControlsQueryResult } from "../extension-kernel";
import { supportedControls } from "./control-declaration-fixtures";
import { controlsQueryResultSchema } from "./control-declarations";

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
