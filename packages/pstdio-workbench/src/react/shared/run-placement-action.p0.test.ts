import { expect, test } from "bun:test";
import { resourceContextMenuPath } from "../../core";
import {
  createResourceViewerFixture,
  viewerPage,
  viewerResource,
} from "../../core/controllers/resource-viewers/resource-viewer-test-fixture";
import { createWorkbenchResourceMenu } from "../menus/resource-menu";

test("a page content menu can switch its invoking viewer", async () => {
  const { w, other } = createResourceViewerFixture();
  other();
  const actions = createWorkbenchResourceMenu(
    w,
    undefined,
    {
      menu: [
        {
          id: "viewer",
          rows: [
            {
              id: "open",
              label: "Open record",
              action: {
                kind: "navigation",
                target: {
                  kind: "viewer",
                  operation: "switch",
                  page: viewerPage("reader"),
                  resource: viewerResource("x"),
                },
              },
            },
          ],
        },
      ],
    },
    w.pages.getContent(),
  );
  await actions[0]!.onClick?.();
  expect(w.pages.getContent()?.resource?.id).toBe("x");
});

test("a captured page menu cannot open its resource in another project", async () => {
  const { w, other } = createResourceViewerFixture();
  other();
  const actions = createWorkbenchResourceMenu(
    w,
    undefined,
    {
      menu: [
        {
          id: "links",
          rows: [
            {
              id: "open",
              label: "Open record",
              action: {
                kind: "navigation",
                target: { kind: "page", page: viewerPage("reader"), resource: viewerResource("x") },
              },
            },
          ],
        },
      ],
    },
    w.pages.getContent(),
  );
  w.pageLocations.setProject("another");
  w.pageLocations.navigate({ kind: "page", page: viewerPage("other") });
  await actions[0]!.onClick?.();
  expect(w.pages.getContent()?.resource).toBeUndefined();
  expect(w.pages.store.getState().location?.page).toEqual(viewerPage("other"));
});

test("resource-kind menu commands receive their invoking viewer context", async () => {
  const { w, openMain } = createResourceViewerFixture();
  await openMain("x");
  let caller: unknown;
  w.commands.registerCommand(
    { id: "inspect", label: "Inspect" },
    {
      execute: (_args, context) => {
        caller = context;
      },
    },
  );
  w.layout.registerMenuItem(resourceContextMenuPath("record"), { commandId: "inspect" });
  const content = w.pages.getContent()!;
  const actions = createWorkbenchResourceMenu(w, content.resource, {}, content);
  await actions[0]!.onClick?.();
  expect(caller).toMatchObject({
    resource: viewerResource("x"),
    placement: content.placementIdentity,
    projectId: "project",
  });
});
