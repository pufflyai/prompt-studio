import { expect, test } from "bun:test";
import { canvasResources } from "./resources";

test("global resource search finds a grouped canvas by its scenarios and source paths", async () => {
  const ctx = { projectId: "canvas-project", extensionId: "pstdio.canvas" } as never;
  const result = await canvasResources.query(ctx, { query: "auto build", limit: 10 } as never);
  expect(result.items.filter((item) => item.label === "Auto Build")).toHaveLength(1);
  expect(result.items.find((item) => item.label === "Auto Build")!.target).toMatchObject({
    kind: "page",
    open: "preview",
    resource: { type: "canvas" },
  });
  expect(await canvasResources.query(ctx, { query: "folder-picker-dialog.stories", limit: 5 } as never)).toMatchObject({
    items: [{ label: "Create folder" }],
  });
});
