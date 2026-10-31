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
    const shortcut = workbench.keyboard.catalog().find((entry) => entry.keys.join(" ") === "MOD+SHIFT+X");
    expect(shortcut).toBeDefined();
    expect(shortcut!.binding.action).toEqual({ kind: "page", page: dashboardExtensionsPage });
    await workbench.navigation.openTarget(shortcut!.binding.action);
    expect(workbench.pages.store.getState().location?.page).toEqual(dashboardExtensionsPage);
  } finally {
    workbench.dispose();
  }
});
