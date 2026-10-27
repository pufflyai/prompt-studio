import type { TreeNode } from "@pstdio/sdk/extensions";
import { canvases } from "./canvases/definitions";
import { canvasGroups } from "./catalog/navigation-groups";
import { canvasResource, canvasTarget } from "./navigation";

export const canvasTree = (projectId: string) => {
  const roots: TreeNode[] = canvasGroups.map((group) => ({
    id: `group-${group}`,
    label: group,
    collapsible: true,
    children: [],
  }));
  for (const canvas of canvases) {
    let parent = roots.find((node) => node.label === canvas.group)!;
    for (const label of canvas.path ?? []) {
      let child = parent.children!.find((node) => node.label === label && node.children);
      if (!child) {
        child = { id: `${parent.id}/${label}`, label, collapsible: true, children: [] };
        parent.children!.push(child);
      }
      parent = child;
    }
    parent.children!.push({
      id: canvas.id,
      label: canvas.name,
      icon: "layout-dashboard",
      target: canvasTarget(canvas.id, canvas.name, projectId),
      resource: { type: canvasResource.id, id: canvas.id, label: canvas.name, projectId, extensionId: "pstdio.canvas" },
    });
  }
  return roots;
};
