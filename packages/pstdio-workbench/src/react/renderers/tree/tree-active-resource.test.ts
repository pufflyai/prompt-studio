import { expect, test } from "bun:test";
import {
  harness,
  navigate,
  openFile,
  panel,
  resource,
} from "../../../core/controllers/composition/placement-lifecycle-test-support";
import { resolveTreeActiveResource } from "./tree-active-resource";

test("navigation selection stays with the page when its document leaves Main", async () => {
  const w = harness();
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget(openFile("first"));
  const page = w.pages.getPage("workspace");
  const selectedResource = () => resolveTreeActiveResource(w.layout.getLayout(), page, w.getPrimaryResource());
  expect(selectedResource()).toEqual(resource("first"));
  const file = w.layout.getLayout().regions.main.widgets[0]!;
  w.movePanel(file.widgetId, "secondary");
  expect(selectedResource()).toEqual(navigate("alpha").resource);
  await w.navigation.openTarget({ kind: "panel", panel, resource: resource("session"), open: "pin" });
  expect(selectedResource()).toEqual(navigate("alpha").resource);
});
