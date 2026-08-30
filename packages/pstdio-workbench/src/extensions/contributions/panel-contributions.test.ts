import { describe, expect, test } from "bun:test";
import type { InternalWorkbenchExtensionMetadata as WorkbenchExtensionMetadata } from "../host/internal-workbench-extension-metadata";
import { panelResourceKinds } from "./panel-contributions";

type PanelRecord = WorkbenchExtensionMetadata["panels"][number];
type PageRecords = WorkbenchExtensionMetadata["pages"];

const panel = (id: string): PanelRecord => ({ id, extensionId: "pstdio.lab", title: id }) as PanelRecord;

const pages: PageRecords = [
  {
    id: "pstdio.lab.page.lab",
    extensionId: "pstdio.lab",
    title: "Lab",
    slots: [
      { id: "cams", region: "main", view: { extensionId: "pstdio.lab", kind: "view", id: "cams" }, order: 0 },
      { id: "inspector", region: "side", cardinality: "many", order: 1 },
    ],
    bindings: [
      {
        resourceKind: { extensionId: "pstdio.lab", kind: "resource-kind", id: "artifact" },
        view: { extensionId: "pstdio.lab", kind: "view", id: "detail" },
        slot: "inspector",
      },
      {
        resourceKind: { extensionId: "pstdio.lab", kind: "resource-kind", id: "blend-project" },
        view: { extensionId: "pstdio.lab", kind: "view", id: "cams" },
        slot: "inspector",
      },
    ],
  },
] as PageRecords;

describe("panelResourceKinds", () => {
  test("a bound-only view is scoped to the kinds its bindings present", () => {
    expect(panelResourceKinds(panel("pstdio.lab.view.detail"), pages)).toEqual(["artifact"]);
  });

  test("a static page slot view stays available without a resource, even when a binding also uses it", () => {
    // The page composes static slots with no resource in hand; scoping the widget to
    // the binding's kind would hide the slot's tab entirely.
    expect(panelResourceKinds(panel("pstdio.lab.view.cams"), pages)).toBeUndefined();
  });
});
