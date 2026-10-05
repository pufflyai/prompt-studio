import { expect, test } from "bun:test";
import {
  harness,
  navigate,
  openFile,
  panel,
  resource,
} from "../../../core/controllers/composition/placement-lifecycle-test-support";
import { resolveTreeActiveResource } from "./tree-active-resource";

test("collection selection follows its open resource after moving it", async () => {
  const w = harness();
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget(openFile("first"));
  const page = w.pages.getPage("workspace");
  expect(resolveTreeActiveResource(w.layout.getLayout(), page)).toEqual(resource("first"));
  const file = w.layout.getLayout().regions.main.widgets[0]!;
  w.movePanel(file.widgetId, "secondary");
  expect(resolveTreeActiveResource(w.layout.getLayout(), page)).toEqual(resource("first"));
  await w.navigation.openTarget({ kind: "panel", panel, resource: resource("session"), open: "pin" });
  expect(resolveTreeActiveResource(w.layout.getLayout(), page)).toEqual(resource("first"));
});
