import { type WorkbenchModuleContribution, workbenchCommandPaletteMenuPath } from "../../../core";
import { DiagnosticsWidget } from "../components/diagnostics-widget";
import {
  diagnosticKind,
  diagnosticResource,
  diagnosticsCommandId,
  diagnosticsModuleId,
  diagnosticsWidgetId,
} from "../data";

export const createDiagnosticsModule = (): WorkbenchModuleContribution => ({
  id: diagnosticsModuleId,
  ownerId: diagnosticsModuleId,
  source: "extension",
  activate(ctx) {
    ctx.resources.registerKind({ kind: diagnosticKind, label: "Diagnostic", icon: "ListChecks" });
    ctx.renderers.registerRenderer({ id: diagnosticsWidgetId, render: (input) => <DiagnosticsWidget input={input} /> });
    ctx.layout.registerWidget({
      id: diagnosticsWidgetId,
      title: "Diagnostics",
      region: "secondary",
      singleton: true,
      rendererId: diagnosticsWidgetId,
      regionSize: { defaultPx: 180, minPx: 120, maxPx: 320 },
    });
    ctx.commands.registerCommand(
      { id: diagnosticsCommandId, label: "Run diagnostics", category: "Dynamic modules", icon: "ListChecks" },
      {
        execute: () => {
          ctx.notifications.show({
            level: "success",
            title: "Diagnostics completed",
            resource: diagnosticResource,
          });
          return ctx.layout.openWidget(diagnosticsWidgetId, { resource: diagnosticResource });
        },
      },
    );
    ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, { commandId: diagnosticsCommandId, order: 30 });
    ctx.layout.openWidget(diagnosticsWidgetId, { resource: diagnosticResource });
  },
});
