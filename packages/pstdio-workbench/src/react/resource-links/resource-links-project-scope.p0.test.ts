import { expect, test } from "bun:test";
import { createWorkbench } from "../../core";
import { closeResourceLinksOnProjectChange } from "./resource-links-project-scope";

test("closes related resources when the project changes", () => {
  const ctx = createWorkbench();
  ctx.pageLocations.setProject("one");
  ctx.views.registerView({ id: "related", title: "Related", body: { kind: "react", render: () => null } });
  ctx.overlays.registerOverlay({ id: "related", viewId: "related" });
  closeResourceLinksOnProjectChange(ctx, "related");
  ctx.overlays.openOverlay("related", { resource: { type: "workspace", id: "w", projectId: "one" } });
  expect(ctx.layout.getLayout().regions.overlay.widgets).toHaveLength(1);
  ctx.pageLocations.setProject("two");
  expect(ctx.layout.getLayout().regions.overlay.widgets).toHaveLength(0);
});
