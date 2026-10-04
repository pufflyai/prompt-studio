import { describe, expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";
import {
  disposeExtensionContributions,
  localizeDashboardExtensionCommandResponse,
  registerExtensionContributions,
  withDashboardWebviewUrls,
} from "./extension-contribution-registration";
import { metadata, metadataWithLabMode, response, withServedDashboardConfig } from "./module-test-fixtures";

withServedDashboardConfig();

describe("withDashboardWebviewUrls", () => {
  test("points extension webviews at their extension's own origin", () => {
    const resolved = withDashboardWebviewUrls(metadataWithLabMode);
    const view = resolved.views.find((candidate) => candidate.localId === "labPage");
    const webview = view?.body.kind === "webview" ? view.body.webview : undefined;

    expect(webview?.runtimeUrl).toBe("http://ext-0123456789abcdef01234567.localhost:19840/v1/extensions/runtime");
    expect(webview?.moduleUrl).toBe(
      "http://ext-0123456789abcdef01234567.localhost:19840/v1/extensions/installed/extension-lab/webviews/labPage/module.js",
    );
  });
});

describe("registerExtensionContributions", () => {
  test("applies explicit navigation from a registered extension action and returns its data", async () => {
    const workbench = createWorkbench();
    const opened: unknown[] = [];
    workbench.commands.registerCommand(
      { id: dashboardCommandIds.openSessionPanel, label: "Open session" },
      {
        execute: (args) => {
          opened.push(args);
        },
      },
    );
    const registration = registerExtensionContributions({
      ctx: workbench,
      metadata,
      projectId: "project-1",
      executeCommand: async () => ({
        ...response,
        outcome: {
          ok: true,
          status: "success",
          value: { type: "session", id: "session-1", title: "Refine ticket", status: "running" },
          navigationRequests: [
            {
              kind: "command",
              target: {
                command: { kind: "command", extensionId: "pstdio", id: dashboardCommandIds.openSessionPanel },
                params: { resource: { type: "session", id: "session-1", label: "Refine ticket" } },
              },
            },
          ],
        },
      }),
    });
    const result = await workbench.commands.executeCommand(metadata.commands[0]!.id);
    expect(result).toMatchObject({ type: "session", id: "session-1", title: "Refine ticket" });
    expect(opened).toMatchObject([{ resource: { type: "session", id: "session-1", label: "Refine ticket" } }]);
    disposeExtensionContributions(registration);
  });

  test("registers a settings placement against the extension View", () => {
    const workbench = createWorkbench();
    const extension = metadata.extensions[0]!;
    const settingsViewId = `${extension.id}.view.settings`;
    const settingsPanelId = `${extension.id}.settings-panel.settings`;
    const settingsMetadata = {
      ...metadata,
      extensions: [{ ...extension, extensionInstanceId: "instance-1", installName: "extension-lab" }],
      views: [
        ...metadata.views,
        {
          id: settingsViewId,
          localId: "settings",
          extensionId: extension.id,
          title: "Lab settings",
          body: {
            kind: "webview" as const,
            webview: {
              entry: { kind: "package-asset" as const, path: "./src/settings.tsx", baseUrl: "file:///extension/" },
              runtimeUrl: "/v1/extensions/runtime",
              moduleUrl: "/v1/extensions/installed/extension-lab/webviews/settings/module.js",
              originLabel: "ext-0123456789abcdef01234567",
              capabilities: ["files.upload", "files.list", "files.delete"],
            },
          },
        },
      ],
      settingsPanels: [
        {
          id: settingsPanelId,
          extensionId: extension.id,
          view: { extensionId: extension.id, kind: "view" as const, id: "settings" },
          slot: { id: "project.settingsPanels" },
        },
      ],
    };

    const registration = registerExtensionContributions({
      ctx: workbench,
      executeCommand: async () => response,
      metadata: settingsMetadata,
      projectId: "project-1",
    });
    const panel = workbench.settings.getPanel(settingsPanelId);
    expect(panel).toMatchObject({ kind: "view", viewId: settingsViewId });
    expect(workbench.views.getView(settingsViewId)?.body.kind).toBe("react");
    disposeExtensionContributions(registration);
  });
});

describe("localizeDashboardExtensionCommandResponse", () => {
  test("resolves command result labels before native views render them", () => {
    const response = localizeDashboardExtensionCommandResponse({
      extensionId: "pstdio.pstdio-planner",
      outcome: {
        status: "success",
        value: {
          params: [
            {
              id: "created",
              name: { $l10n: "ticketDetail.createdAt", default: "Created at" },
              type: "property",
              value: "2026-08-26",
            },
          ],
        },
      },
    });

    expect(response.outcome.value.params[0]?.name).toBe("Created at");
  });
});

describe("existing extension behavior during SDK preparation", () => {
  test("opens the session returned by a registered extension action", async () => {
    const workbench = createWorkbench();
    const opened: unknown[] = [];
    workbench.commands.registerCommand(
      { id: dashboardCommandIds.openSessionPanel, label: "Open session" },
      {
        execute: (args) => {
          opened.push(args);
        },
      },
    );
    const registration = registerExtensionContributions({
      ctx: workbench,
      metadata,
      projectId: "project-1",
      executeCommand: async () => ({
        ...response,
        outcome: {
          ok: true,
          status: "success",
          value: { type: "session", id: "session-1", title: "Refine ticket", status: "running" },
        },
      }),
    });
    await workbench.commands.executeCommand(metadata.commands[0]!.id);
    expect(opened).toMatchObject([{ resource: { type: "session", id: "session-1", label: "Refine ticket" } }]);
    disposeExtensionContributions(registration);
  });
});
