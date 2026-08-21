import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "../../../core";
import { WorkbenchControlsView } from "./controls-view";
import { installWorkbenchControlsRenderer } from "./install-controls-renderer";

describe("installWorkbenchControlsRenderer", () => {
  test("renders the registered controls contribution", () => {
    const workbench = createWorkbenchCore();

    installWorkbenchControlsRenderer(workbench);
    workbench.renderers.registerControlsRenderer({
      id: "ticket.controls",
      title: "Ticket controls",
      executeQuery: () => ({ params: [] }),
    });

    const renderer = workbench.renderers.getRenderer("ticket.controls");
    const rendered = renderer?.render({
      workbench,
      panel: workbench.layout.registerPanel({
        id: "ticket.controls",
        title: "Ticket controls",
        region: "main-right-menu",
        rendererId: "ticket.controls",
      }) as never,
      instance: {
        instanceId: "ticket.controls",
        panelId: "ticket.controls",
        closable: false,
        title: "Ticket controls",
      },
      refresh: () => undefined,
    }) as { type?: unknown; props?: { contribution?: { id: string } } };

    expect(rendered.type).toBe(WorkbenchControlsView);
    expect(rendered.props?.contribution?.id).toBe("ticket.controls");
  });
});
