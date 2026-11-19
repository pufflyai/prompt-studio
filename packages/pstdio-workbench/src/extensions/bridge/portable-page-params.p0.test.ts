import { expect, test } from "bun:test";
import type { WorkbenchCore } from "../../core";
import {
  createResourceViewerFixture,
  viewerPage,
  viewerPanel,
  viewerResource,
} from "../../core/controllers/resource-viewers/resource-viewer-test-fixture";
import { createWorkbenchWebviewHostCapabilities } from "./webview-host-capabilities";

for (const method of ["drag", "panel"] as const)
  for (const sameExtension of [false, true])
    test(`a page transferred by ${method} updates its own params; Main has same extension=${sameExtension}`, async () => {
      const registerPages = (w: WorkbenchCore) => {
        for (const id of ["form", "second"])
          w.pages.registerPage({
            ...w.pages.getPage(id === "form" && method === "panel" ? "reader" : "other")!,
            id,
            ref: viewerPage(id),
            path: id,
            params: { form: { type: "string", values: ["rule", "other"] } },
          });
      };
      const { w, saved, locations } = createResourceViewerFixture({ registerPages });
      await w.navigation.openPage({
        page: viewerPage("form"),
        params: { form: "rule" },
        ...(method === "panel" ? { resource: viewerResource("a") } : {}),
      });
      const content = w.pages.getContent()!;
      const owner = createWorkbenchWebviewHostCapabilities({
        workbench: w,
        placement: { ...content, panelId: content.contributionId, instanceId: content.widgetId, closable: true },
        projectId: "project",
        extensionId: "example.readers",
      });
      if (method === "drag") w.movePanel(content.widgetId, "side");
      else await w.navigation.openPanel({ panel: viewerPanel, resource: viewerResource("a"), open: "pin" });
      if (sameExtension) await w.navigation.openPage({ page: viewerPage("second"), params: { form: "other" } });
      const main = w.pages.store.getState().location;
      const history = w.pageLocations.historyStore.getState();
      expect(owner["page.params.update"]({ params: { form: null } })).toMatchObject({
        location: { page: viewerPage("form"), params: undefined },
      });
      expect(w.layout.getActivePanel("side")?.pageContext?.params).toBeUndefined();
      expect(w.pages.store.getState().location).toBe(main);
      expect(w.pageLocations.historyStore.getState()).toEqual(history);
      expect(() => owner["page.params.update"]({ params: { invalid: true } })).toThrow("page_param_invalid");
      expect(() => owner["page.params.update"]({ params: { form: "invalid" } })).toThrow();
      const side = w.layout.getActivePanel("side")!;
      const foreign = createWorkbenchWebviewHostCapabilities({
        workbench: w,
        placement: side,
        projectId: "project",
        extensionId: "foreign",
      });
      expect(() => foreign["page.params.update"]({ params: { form: "rule" } })).toThrow("page_params_not_owner");
      owner["page.params.update"]({ params: { form: "other" } });
      const restored = createResourceViewerFixture({ saved, locations, registerPages }).w;
      restored.pageLocations.boot("project");
      expect(restored.layout.getActivePanel("side")?.pageContext?.params).toEqual({ form: "other" });
      w.closePlacement(w.layout.getActivePanel("side")!.placementIdentity!);
      expect(() => owner["page.params.update"]({ params: { form: null } })).toThrow("no longer open");
    });
