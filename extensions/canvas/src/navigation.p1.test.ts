import { expect, test } from "bun:test";
import type { TreeNode } from "@pstdio/sdk/extensions";
import extension from "../extension";
import { canvasPage, homePage } from "./navigation";
import { resolveCanvasCommand } from "./resource";
import { testContext, testManifest } from "./test-build";

const leaves = (nodes: TreeNode[]): TreeNode[] =>
  nodes.flatMap((node) => (node.children ? leaves(node.children) : [node]));

test("the canvas navigation panel exposes each grouped resource on overview and detail pages", async () => {
  const { ctx } = await testContext();
  for (const page of [homePage, canvasPage]) {
    const navigation = extension.navigationTrees.find((entry) => entry.owner.id === page.id);
    expect(navigation).toBeDefined();
    const view = extension.views.find((view) => view.ref.id === navigation!.view.id)!;
    if (view.body.kind !== "tree") throw new Error("Canvas selection must use the navigation tree");
    const sections = await view.body.body(ctx);
    expect(sections[0].nodes.map((node) => node.label)).toEqual(["Components", "Design System"]);
    const resources = sections.flatMap((section) => leaves(section.nodes));
    expect(resources.map((node) => node.resource!.id).sort()).toEqual(
      testManifest()
        .canvases.map((canvas) => canvas.id)
        .sort(),
    );
    for (const node of resources)
      expect(node.target).toMatchObject({
        kind: "page",
        open: "preview",
        resource: {
          type: "canvas",
          id: node.resource!.id,
          icon: "diamond",
          projectId: ctx.projectId,
          extensionId: "pstdio.canvas",
        },
      });
  }
});

test("resolving a restored canvas replaces its stale resource icon", async () => {
  const { ctx } = await testContext();
  ctx.resource = { type: "canvas", id: "src/foundations.canvas.tsx", icon: "table-properties" };
  expect(await resolveCanvasCommand.run(ctx, {})).toMatchObject({ id: "src/foundations.canvas.tsx", icon: "diamond" });
});
