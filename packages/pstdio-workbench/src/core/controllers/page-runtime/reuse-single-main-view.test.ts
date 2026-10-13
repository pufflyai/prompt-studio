import { expect, test } from "bun:test";
import { resourceKey } from "@pstdio/sdk/extensions";
import { createDefaultWorkbenchLayout, type WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { reuseSingleMainView } from "./reuse-single-main-view";

const page = (id: string, parentId?: string) => ({
  id,
  ref: { kind: "page" as const, extensionId: "test", id },
  path: id,
  modeId: "project",
  parentId,
  main: { kind: "view" as const, view: { kind: "view" as const, id: "files" }, cardinality: "one" as const },
  slots: [],
});
const pages = { parent: page("parent"), child: page("child", "parent") };
const placement = (pageId: string, widgetId: string, transferred: boolean) => {
  const resource = { type: "file", id: widgetId };
  return {
    widgetId,
    contributionId: `${pageId}-main`,
    viewId: "files",
    role: "location" as const,
    resource,
    resourceKey: resourceKey(resource),
    placementIdentity: {
      kind: "page" as const,
      pageId,
      slotId: transferred ? widgetId : "$main",
      instanceKey: transferred ? widgetId : "single",
    },
    ...(transferred
      ? {
          declarationIdentity: {
            kind: "mode" as const,
            modeId: "project",
            placementId: "files",
            instanceKey: widgetId,
          },
        }
      : {}),
  } satisfies WorkbenchWidgetPlacement;
};

test.each([
  "source",
  "target",
])("family reuse retains the transferred %s tab's physical and resource identity", (side) => {
  const previous = createDefaultWorkbenchLayout();
  const next = createDefaultWorkbenchLayout();
  previous.regions.main.widgets = [placement("parent", "original", side === "source")];
  next.regions.main.widgets = [placement("child", "destination", side === "target")];
  expect(reuseSingleMainView(previous, next, pages)).toEqual(next);
  expect(previous.regions.main.widgets[0]!.resource?.id).toBe("original");
});

test("related native single Main pages keep their live view while rebinding the resource", () => {
  const previous = createDefaultWorkbenchLayout();
  const next = createDefaultWorkbenchLayout();
  previous.regions.main.widgets = [placement("parent", "original", false)];
  next.regions.main.widgets = [placement("child", "destination", false)];
  const [reused] = reuseSingleMainView(previous, next, pages).regions.main.widgets;
  expect(reused).toMatchObject({
    widgetId: "original",
    resource: { type: "file", id: "destination" },
    placementIdentity: next.regions.main.widgets[0]!.placementIdentity,
  });
});
