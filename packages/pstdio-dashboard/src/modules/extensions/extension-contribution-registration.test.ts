import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
import { BRIDGE_WEBVIEW_RENDERER_ID } from "@pstdio/workbench/extensions";
import { dashboardActiveCollectionContextKey } from "@/shared/app/navigation-state";
import { modeOwnsNavigation } from "@/shared/workbench/mode-navigation-ownership";
import { ExtensionViewWidget } from "./components/extension-view-widget";
import {
  extensionViewResolveInput,
  localizeDashboardExtensionCommandResponse,
  registerDashboardExtensionWebviewRenderer,
  registerExtensionActivityNavigationOwnership,
  withDashboardWebviewUrls,
} from "./extension-contribution-registration";
import { metadataWithLabMode } from "./module-test-fixtures";

describe("extensionViewResolveInput", () => {
  test("enters Project navigation before opening an extension view", () => {
    const workbench = createWorkbenchCore();
    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });

    const openInput = { pinned: true };
    const resolved = extensionViewResolveInput(workbench, {
      id: "pstdio.extension-lab.view.overview",
      title: "Overview",
      icon: "flask",
    })(openInput);

    expect(resolved).toBe(openInput);
    expect(workbench.modes.getActiveModeId()).toBe("project");
    expect(workbench.context.get(dashboardActiveCollectionContextKey)).toBeUndefined();
    expect(workbench.breadcrumbs.getItems()).toEqual([{ title: "Overview", icon: "flask" }]);
  });

  test("leaves resource navigation to the resource presenter", () => {
    const workbench = createWorkbenchCore();
    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    const resource = {
      kind: "ticket",
      uri: "pstdio://ticket/PS-299",
      id: "PS-299",
      label: "PS-299",
    };
    const openInput = { resource };

    const resolved = extensionViewResolveInput(workbench, {
      id: "pstdio.pstdio-planner.view.ticket-editor",
      title: "Ticket",
    })(openInput);

    expect(resolved).toBe(openInput);
    expect(workbench.modes.getActiveModeId()).toBeUndefined();
    expect(workbench.breadcrumbs.getItems()).toBeUndefined();
  });
});

describe("registerExtensionActivityNavigationOwnership", () => {
  test("marks modes with activity items as navigation owners", () => {
    const modeId = "pstdio.extension-lab.mode.lab";
    const metadata = {
      ...metadataWithLabMode,
      activityItems: [
        {
          id: "pstdio.extension-lab.activity-item.home",
          extensionId: "pstdio.extension-lab",
          title: "Home",
          icon: "house",
          modes: [{ extensionId: "pstdio.extension-lab", kind: "mode" as const, id: "lab" }],
          command: { extensionId: "pstdio", kind: "command" as const, id: "workbench.action.switchMode" },
        },
      ],
    };

    const registration = registerExtensionActivityNavigationOwnership(metadata);
    expect(modeOwnsNavigation(modeId)).toBe(true);

    registration.dispose();
    expect(modeOwnsNavigation(modeId)).toBe(false);
  });
});

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

describe("registerDashboardExtensionWebviewRenderer", () => {
  test("uses the dashboard webview host for extension view panels", () => {
    const workbench = createWorkbenchCore();
    const registration = registerDashboardExtensionWebviewRenderer(workbench);
    workbench.layout.registerPanel({
      id: "extension.view",
      title: "Extension view",
      region: "main",
      rendererId: BRIDGE_WEBVIEW_RENDERER_ID,
    });
    const panel = workbench.layout.getWidget("extension.view")!;
    const renderer = workbench.renderers.getRenderer(BRIDGE_WEBVIEW_RENDERER_ID)!;

    const element = renderer.render({
      workbench,
      panel,
      instance: { instanceId: panel.id, panelId: panel.id, closable: false },
      refresh: () => undefined,
    }) as { type: unknown };

    expect(element.type).toBe(ExtensionViewWidget);
    registration?.dispose();
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
