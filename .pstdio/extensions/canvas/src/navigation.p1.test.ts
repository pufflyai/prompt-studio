import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import extension from "../extension";
import { canvases } from "./canvases/definitions";
import { canvasPage, homePage } from "./navigation";

test("the canvas navigation panel exposes each grouped resource on overview and detail pages", async () => {
  const ctx = makeCommandContext({ storage: createMemoryStorage(), params: {} });
  for (const page of [homePage, canvasPage]) {
    const navigation = extension.navigationTrees.find((entry) => entry.owner.id === page.id);
    expect(navigation).toBeDefined();
    const view = extension.views.find((view) => view.ref.id === navigation!.view.id)!;
    if (view.body.kind !== "tree") throw new Error("Canvas selection must use the navigation tree");
    const sections = await view.body.body(ctx);
    const resources = sections.flatMap((section) => section.nodes.flatMap((group) => group.children ?? []));
    expect(resources.map((node) => node.resource!.id).sort()).toEqual(canvases.map((canvas) => canvas.id).sort());
    for (const node of resources)
      expect(node.target).toMatchObject({
        kind: "page",
        resource: { type: "canvas", id: node.resource!.id, projectId: ctx.projectId, extensionId: "pstdio.canvas" },
      });
  }
});
