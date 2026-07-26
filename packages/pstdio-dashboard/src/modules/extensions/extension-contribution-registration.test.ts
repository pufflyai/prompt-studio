import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench/core";
import {
  type DashboardExtensionMetadata,
  emptyDashboardExtensionMetadata,
} from "@/shared/extensions/workbench-extension-contributions";
import { registerExtensionContributions } from "./extension-contribution-registration";

const stubWebview = (name: string) => ({
  entry: {
    kind: "package-asset" as const,
    path: `./src/views/${name}.tsx`,
    baseUrl: "file:///extensions/test/extension.ts",
  },
  runtimeUrl: `/runtime/${name}.html`,
  moduleUrl: `/modules/${name}.js`,
});

const metadata = {
  ...emptyDashboardExtensionMetadata,
  extensions: [
    { id: "pstdio.extension-lab", name: "extension-lab", displayName: "Extension Lab", sourcePath: "" },
    { id: "pstdio.pstdio-planner", name: "pstdio-planner", displayName: "Planner", sourcePath: "" },
  ],
  views: [
    {
      id: "extension-lab.stale-sidebar",
      extensionId: "pstdio.extension-lab",
      slotId: "workbench.main",
      target: "workbench.main",
      title: "Stale Lab sidebar",
      role: "panel-menu",
      webview: stubWebview("stale-lab-sidebar"),
    },
  ],
  settingsPanels: [
    {
      id: "pstdio-planner.ticketStatuses",
      extensionId: "pstdio.pstdio-planner",
      slotId: "project.settingsPanels",
      target: "workbench.settings",
      scope: "project",
      title: "Ticket statuses",
      icon: "list-checks",
      webview: stubWebview("ticket-statuses"),
    },
  ],
} satisfies DashboardExtensionMetadata;

describe("registerExtensionContributions", () => {
  test("keeps one invalid extension from removing another extension's settings", () => {
    const workbench = createWorkbenchCore();
    const errors: Array<{ error: unknown; extensionId: string }> = [];

    workbench.registerModule({
      id: "test.extension-isolation",
      activate: (ctx) => {
        ctx.settings.registerSection({ id: "project", title: "Project" });
        ctx.settings.registerSection({ id: "workbench", title: "Workbench" });
        return registerExtensionContributions({
          ctx,
          executeCommand: async () => {
            throw new Error("not used");
          },
          metadata,
          projectId: "project-1",
          onRegistrationError: (error, extensionId) => errors.push({ error, extensionId }),
        });
      },
    });

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      extensionId: "pstdio.extension-lab",
      error: expect.any(Error),
    });
    expect(workbench.settings.getPanel("pstdio-planner.ticketStatuses")?.title).toBe("Ticket statuses");
  });
});
