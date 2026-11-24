import { describe, expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { registerCopyPageLink } from "./copy-page-link";
import { createHeadersModule } from "./module";

describe("createHeadersModule", () => {
  test("places page navigation in Nav Chrome without adding it to the Sidenav", async () => {
    const workbench = createWorkbench();

    workbench.registerModule(createHeadersModule());

    expect(workbench.layout.listPanelInstances("nav")).toContainEqual(
      expect.objectContaining({
        viewId: dashboardWidgetIds.projectHeader,
        closable: false,
      }),
    );
    expect(
      await workbench.navigationTrees.getSections({ kind: "mode", id: "project", extensionId: "pstdio" }, "header"),
    ).toEqual([]);
  });
});

test("Copy link starts in the selection gesture and shows progress until the clipboard replies", async () => {
  const workbench = createWorkbench();
  const url = "http://localhost/projects/project/files";
  const release = Promise.withResolvers<void>();
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const writes: string[] = [];
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { href: url } } });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      clipboard: {
        writeText: (value: string) => {
          writes.push(value);
          return release.promise;
        },
      },
    },
  });
  try {
    registerCopyPageLink(workbench);
    const action = workbench.commands.executeCommand("dashboard.page.copyLink");
    expect(writes).toEqual([url]);
    expect(workbench.notifications.listNotifications().map(({ title }) => title)).toEqual(["Copying link…"]);
    release.resolve();
    await action;
    expect(workbench.notifications.listNotifications().map(({ title }) => title)).toEqual(["Link copied"]);
  } finally {
    release.resolve();
    if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor);
    else Reflect.deleteProperty(globalThis, "window");
    if (navigatorDescriptor) Object.defineProperty(globalThis, "navigator", navigatorDescriptor);
    else Reflect.deleteProperty(globalThis, "navigator");
    await workbench.dispose();
  }
});
