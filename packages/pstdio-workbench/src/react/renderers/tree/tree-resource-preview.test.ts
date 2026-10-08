import { expect, test } from "bun:test";
import type { TreeViewSection } from "../../../core";
import { createResourcePreview } from "../../../core/registries/resources/resource-preview";
import { previewTreeResources } from "./tree-resource-preview";

test("preserves a tree's contextual label until that resource has a pending rename", () => {
  const resource = { type: "run", id: "one", extensionId: "radar", projectId: "project", label: "Oct 8" };
  const sections: TreeViewSection[] = [{ id: "runs", nodes: [{ id: "one", label: "Today", resource }] }];
  const previews = createResourcePreview();
  const project = () => previewTreeResources(sections, {}, previews.store.getState().changes);
  expect(project()[0].nodes[0].label).toBe("Today");
  const other = previews.begin({ ...resource, id: "other" }, { label: "Unrelated" });
  expect(project()[0].nodes[0].label).toBe("Today");
  const rename = previews.begin(resource, { label: "Renamed" });
  expect(project()[0].nodes[0].label).toBe("Renamed");
  rename.rollback();
  expect(project()[0].nodes[0].label).toBe("Today");
  other.rollback();
  const remove = previews.begin(resource, { removed: true });
  expect(project()[0].nodes).toEqual([]);
  remove.rollback();
  expect(project()[0].nodes[0].label).toBe("Today");
});
