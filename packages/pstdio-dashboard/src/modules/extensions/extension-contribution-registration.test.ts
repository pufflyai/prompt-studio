import { describe, expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";
import {
  disposeExtensionContributions,
  localizeDashboardExtensionCommandResponse,
  registerExtensionContributions,
  withDashboardWebviewUrls,
} from "./extension-contribution-registration";
import { metadata, metadataWithLabMode, response } from "./module-test-fixtures";

describe("withDashboardWebviewUrls", () => {
  test("points extension webviews at the configured API origin", () => {
    const runtime = globalThis as typeof globalThis & { __PSTDIO_CONFIG__?: { apiBaseUrl?: string } };
    runtime.__PSTDIO_CONFIG__ = { apiBaseUrl: "http://localhost:19840" };

    try {
      const resolved = withDashboardWebviewUrls(metadataWithLabMode);
      const view = resolved.views.find((candidate) => candidate.localId === "labPage");

      expect(view?.body.kind === "webview" ? view.body.webview.runtimeUrl : undefined).toBe(
        "http://localhost:19840/v1/extensions/runtime",
      );
    } finally {
      delete runtime.__PSTDIO_CONFIG__;
    }
  });
});

describe("registerExtensionContributions", () => {
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
