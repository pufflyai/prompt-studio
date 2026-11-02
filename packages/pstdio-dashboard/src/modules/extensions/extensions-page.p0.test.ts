import { expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { dashboardExtensionsPage } from "@/shared/app/resources";
import { registerExtensionsPage } from "./extensions-page";

const setup = () => {
  const workbench = createWorkbench();
  workbench.modes.registerMode({ id: "project", activate() {} });
  workbench.registerModule({
    id: "extensions-test",
    activate(ctx) {
      registerExtensionsPage(ctx);
      return [];
    },
  });
  workbench.pageLocations.setProject("project-1");
  return workbench;
};

test("keeps Extensions reachable in the pinned navigation footer", async () => {
  const workbench = setup();
  try {
    const sections = await workbench.navigationTrees.getSections(
      { kind: "mode", id: "project", extensionId: "pstdio" },
      "footer",
    );
    expect(sections.flatMap((section) => section.nodes)).toContainEqual(
      expect.objectContaining({ label: "Extensions", target: { kind: "page", page: dashboardExtensionsPage } }),
    );
  } finally {
    workbench.dispose();
  }
});

test("offers a direct keyboard shortcut that opens Extensions", async () => {
  const workbench = setup();
  try {
    const shortcut = workbench.keyboard.catalog().find((entry) => entry.keys.join(" ") === "ALT+SHIFT+O");
    expect(shortcut).toBeDefined();
    expect(shortcut!.binding.action).toEqual({ kind: "page", page: dashboardExtensionsPage });
    await workbench.navigation.openTarget(shortcut!.binding.action);
    expect(workbench.pages.store.getState().location?.page).toEqual(dashboardExtensionsPage);
  } finally {
    workbench.dispose();
  }
});

test("opens extension details as a nested page and returns to its parent", () => {
  const workbench = setup();
  try {
    const detail = { ...dashboardExtensionsPage, id: "extension-detail" };
    const resource = { type: "extension", extensionId: "pstdio", id: "installed:instance-one", label: "Claude Code" };
    const result = workbench.pageLocations.navigate({ kind: "page", page: detail, resource });
    expect(result.ok).toBe(true);
    expect(workbench.pages.getPage("extension-detail")?.parentId).toBe("extensions");
    expect(workbench.pages.store.getState().location?.resource).toMatchObject(resource);
    const location = workbench.pages.store.getState().location!;
    const restored = setup();
    try {
      expect(restored.pageLocations.replay(location).ok).toBe(true);
      expect(restored.pages.store.getState().location?.resource?.id).toBe(resource.id);
      expect(restored.pageLocations.navigateToParent().ok).toBe(true);
      expect(restored.pages.store.getState().location?.page).toEqual(dashboardExtensionsPage);
      expect(restored.pages.store.getState().location?.resource).toBeUndefined();
    } finally {
      restored.dispose();
    }
  } finally {
    workbench.dispose();
  }
});
