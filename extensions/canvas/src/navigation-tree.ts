import type { CanvasEntry } from "@pstdio/canvas";
import type { TreeNode } from "@pstdio/sdk/extensions";
import { canvasResource, canvasTarget } from "./navigation";

// Titles such as "Design System/Components/Button" become nested folders, sorted by title.
export const canvasTree = (projectId: string, canvases: readonly CanvasEntry[]) => {
  const roots: TreeNode[] = [];
  const folder = (siblings: TreeNode[], id: string, label: string) => {
    let node = siblings.find((entry) => entry.children && entry.label === label);
    if (!node) {
      node = { id, label, collapsible: true, children: [] };
      siblings.push(node);
    }
    return node.children!;
  };
  for (const canvas of [...canvases].sort((a, b) => a.title.localeCompare(b.title))) {
    let siblings = roots;
    let path = "group";
    for (const label of canvas.group.split("/").filter(Boolean)) {
      path = `${path}/${label}`;
      siblings = folder(siblings, path, label);
    }
    siblings.push({
      id: canvas.id,
      label: canvas.name,
      icon: canvasResource.icon,
      target: canvasTarget(canvas.id, canvas.name, projectId),
      resource: { type: canvasResource.id, id: canvas.id, label: canvas.name, projectId, extensionId: "pstdio.canvas" },
    });
  }
  return roots;
};
