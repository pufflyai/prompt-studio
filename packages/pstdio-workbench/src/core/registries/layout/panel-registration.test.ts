import { describe, expect, test } from "bun:test";
import { createLayoutModel } from "./layout-model";

describe("Panel registration", () => {
  test("registers and opens menus declared by their Location Panel", () => {
    const layout = createLayoutModel();

    layout.registerLocation({
      id: "project.notes",
      title: "Notes",
      region: "main",
      singleton: false,
      rendererId: "notes.renderer",
      panelMenus: [
        {
          id: "project.notes.outline",
          title: "Outline",
          icon: "ListTree",
          side: "left",
          rendererId: "outline.renderer",
        },
      ],
    });

    const notes = layout.openWidget("project.notes", {
      resource: { kind: "project", uri: "pstdio://project/alpha", label: "Alpha" },
    });

    expect(layout.getWidget("project.notes.outline")).toMatchObject({
      region: "main-left-menu",
      panelMenuOwner: { level: "panel", contributionId: "project.notes" },
      role: "panel-menu",
    });
    expect(layout.getLayout().regions["main-left-menu"].widgets).toEqual([
      expect.objectContaining({
        contributionId: "project.notes.outline",
        ownerResourceUri: "pstdio://project/alpha",
      }),
    ]);
    expect(layout.getWidget("project.notes")?.closable).toBe(false);
    expect(notes.closable).toBe(false);
    expect(layout.getLayout().regions.main.activeWidgetId).toBe(notes.widgetId);
  });

  test("gives every registration of a Sub Panel its declared menus", () => {
    const layout = createLayoutModel();

    layout.registerLocation({
      id: "project.location",
      title: "Project",
      region: "main",
      singleton: false,
      rendererId: "project.renderer",
    });
    layout.openWidget("project.location", {
      resource: { kind: "project", uri: "pstdio://project/alpha", label: "Alpha" },
    });

    for (const region of ["main", "secondary", "side"] as const) {
      layout.registerSubPanel({
        id: `project.${region}.notes`,
        title: "Notes",
        region,
        rendererId: "notes.renderer",
        panelMenus: [
          {
            id: `project.${region}.notes.tools`,
            title: "Notes tools",
            icon: "FileText",
            side: "right",
            rendererId: "notes-tools.renderer",
          },
        ],
      });
      layout.openWidget(`project.${region}.notes`);
    }

    expect(layout.getLayout().regions["main-right-menu"].widgets).toHaveLength(1);
    expect(layout.getLayout().regions["secondary-right-menu"].widgets).toHaveLength(1);
    expect(layout.getLayout().regions["side-right-menu"].widgets).toHaveLength(1);
    expect(layout.getWidget("project.secondary.notes.tools")).toMatchObject({
      region: "secondary-right-menu",
      panelMenuOwner: { level: "sub-panel", contributionId: "project.secondary.notes" },
    });
  });

  test("disposes a Panel and all menus declared by it", () => {
    const layout = createLayoutModel();
    const registration = layout.registerSubPanel({
      id: "project.notes",
      title: "Notes",
      region: "main",
      rendererId: "notes.renderer",
      panelMenus: [
        {
          id: "project.notes.tools",
          title: "Notes tools",
          side: "right",
          rendererId: "notes-tools.renderer",
        },
      ],
    });

    registration.dispose();

    expect(layout.getWidget("project.notes")).toBeUndefined();
    expect(layout.getWidget("project.notes.tools")).toBeUndefined();
  });

  test("requires a Location with menus to target a Panel region", () => {
    const layout = createLayoutModel();

    expect(() =>
      layout.registerLocation({
        id: "project.navigator",
        title: "Navigator",
        region: "sidenav",
        rendererId: "navigator.renderer",
        panelMenus: [
          {
            id: "project.navigator.tools",
            title: "Navigator tools",
            side: "right",
            rendererId: "navigator-tools.renderer",
          },
        ],
      }),
    ).toThrow("Panel Menus require a Panel region: project.navigator");
  });
});
