import { activateProductModule, adaptRuntimeExtensionContributions, createShellCore } from "../core";
import { shellExampleResources, shellExampleTickets, shellWidgetIds } from "./consumer-shell-example-data";
import { createConsumerShellRenderers } from "./consumer-shell-example-views";
import { createProjectModule, projectScope } from "./consumer-shell-project-module";
import { createRuntimeExtension } from "./consumer-shell-runtime-extension";

interface ConsumerShellExampleInput {
  initialWidgetId?: string;
}

const resolveInitialResource = (widgetId: string) => {
  if (widgetId === shellWidgetIds.tickets) return shellExampleResources.tickets;
  if (widgetId === shellWidgetIds.workspace) return shellExampleResources.workspace;
  if (widgetId === shellWidgetIds.settings) return shellExampleResources.settings;
  if (widgetId === shellWidgetIds.registryInventory) return shellExampleResources.registryInventory;
  if (widgetId === shellWidgetIds.extensionReview) return shellExampleResources.extensionReview;
  return shellExampleResources.project;
};

export const createConsumerShellExample = (input: ConsumerShellExampleInput = {}) => {
  const shell = createShellCore();
  shell.context.set("project.open", true);
  shell.context.set("project.previewOpen", true);
  shell.context.set("selection.kind", "ticket");

  activateProductModule(shell, createProjectModule());
  adaptRuntimeExtensionContributions(shell, createRuntimeExtension(shell));
  shell.resources.registerOpener({
    id: "extension.reviewOpener",
    priority: 80,
    canOpen: (resource) => resource.kind === "extension-review",
    open: (resource) => shell.layout.openWidget(shellWidgetIds.extensionReview, { resource, title: resource.label }),
  });
  shell.preferences.setValue("extensionLab.reviewMode", "strict", projectScope);
  shell.diagnostics.report({
    id: "project.ticket-links",
    source: "project.checks",
    severity: "warning",
    message: "PS-266 has a workspace but no packaged smoke-test note.",
    resource: shellExampleResources.ticket266,
    code: "PSTDIO-SHELL-1",
    actions: [
      {
        commandId: "project.clearDiagnostic",
        title: "Clear",
        args: { diagnosticId: "project.ticket-links" },
      },
    ],
  });
  shell.diagnostics.report({
    id: "extension.review-lint",
    source: "extension-lab.review-lint",
    severity: "info",
    message: "Extension review webview is registered with a runtime URL.",
    resource: shellExampleResources.extensionReview,
    actions: [{ commandId: "extension-lab.review.open", title: "Open" }],
  });
  shell.activity.emit({
    id: "activity.session-started",
    kind: "session.event",
    title: "Session attached",
    message: "Workspace PS-266 is using the floating shell session panel.",
    severity: "info",
    createdAt: "2026-05-13T10:03:00.000Z",
    resource: shellExampleResources.workspace,
  });
  shell.activity.emit({
    id: "activity.extension-review",
    kind: "extension.review",
    title: "Extension review queued",
    severity: "info",
    createdAt: "2026-05-13T10:02:00.000Z",
    resource: shellExampleResources.extensionReview,
  });
  void shell.lifecycle.runHooks("activate");

  shell.layout.openWidget(shellWidgetIds.session);
  shell.layout.openWidget(shellWidgetIds.checks);

  const initialWidgetId = input.initialWidgetId ?? shellWidgetIds.overview;
  shell.layout.openWidget(initialWidgetId, {
    resource: resolveInitialResource(initialWidgetId),
  });

  return {
    shell,
    renderers: createConsumerShellRenderers(shellExampleTickets.map((ticket) => ticket.resource.id)),
  };
};
