import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { matchesResourceWhen } from "@pstdio/sdk/extensions";
import { text } from "pstdio-extensions/workbench";
import type { Disposable, WorkbenchCommandExecutionContext } from "../../core";
import { workbenchCommandPaletteMenuPath } from "../../core";
import { registerWorkbenchExtensionCommandPaletteResources } from "../contributions/command-palette-resource-contributions";
import { registerWorkbenchExtensionControlsRenderers } from "../contributions/controls-renderer-contributions";
import { registerWorkbenchExtensionDataTableRenderers } from "../contributions/data-table-renderer-contributions";
import {
  buildWorkbenchExtensionCommandPaletteRegistrations,
  buildWorkbenchExtensionMenuRegistrations,
} from "../contributions/extension-contributions";
import { registerWorkbenchExtensionFileRenderers } from "../contributions/file-renderer-contributions";
import { registerWorkbenchExtensionKanbanRenderers } from "../contributions/kanban-renderer-contributions";
import { registerWorkbenchExtensionNavigationItems } from "../contributions/navigation-item-contributions";
import { registerWorkbenchExtensionTreeRenderers } from "../contributions/tree-renderer-contributions";
import {
  createExtensionSlot,
  executeWorkbenchExtensionCommand,
  type WorkbenchExtensionCommandContext,
} from "./workbench-extension-command";
import { registerComposition, registerModes, registerResourcePresenters } from "./workbench-extension-composition";
import type {
  InternalRegisterWorkbenchExtensionContributionsInput,
  RegisterWorkbenchExtensionContributionsInput,
} from "./workbench-extension-host-types";
import { registerWorkbenchExtensionKeybindings } from "./workbench-extension-keybindings";

export type { RegisterWorkbenchExtensionContributionsInput } from "./workbench-extension-host-types";

import { toInternalWorkbenchExtensionMetadata } from "./workbench-extension-metadata-adapter";
import { registerWorkbenchExtensionRendererRefreshEvents } from "./workbench-extension-refresh";
import {
  registerBridgeRenderer,
  registerSettings,
  registerStatuses,
  registerWebviewPanels,
} from "./workbench-extension-surfaces";

const disposeAll = (disposables: Disposable[]) => {
  for (let index = disposables.length - 1; index >= 0; index -= 1) disposables[index]?.dispose();
};

const asParams = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;

const prepareCommandArgs = (
  context: WorkbenchExtensionCommandContext,
  commandId: string,
  args: unknown,
  executionContext?: WorkbenchCommandExecutionContext,
  onArgsChange?: (args: unknown) => void,
) => context.prepareCommandArgs?.(commandId, args, executionContext, onArgsChange) ?? args;

const registerCommands = (
  context: WorkbenchExtensionCommandContext,
  metadata: Pick<WorkbenchExtensionMetadata, "commands">,
) =>
  metadata.commands.map((command) =>
    context.workbench.commands.registerCommand(
      {
        id: command.id,
        label: text(command.title, command.id),
        description: text(command.description),
        params: command.params,
      },
      {
        prepareArgs: (args, executionContext, onArgsChange) =>
          prepareCommandArgs(context, command.id, args, executionContext, onArgsChange),
        execute: (args, executionContext) =>
          executeWorkbenchExtensionCommand(context, command.id, {
            params: asParams(args),
            resource: executionContext?.resource,
          }),
      },
    ),
  );

const menuCommandResource = (
  input: InternalRegisterWorkbenchExtensionContributionsInput,
  executionContext: WorkbenchCommandExecutionContext | undefined,
) => executionContext?.resource ?? input.workbench.getPrimaryResource();

const registerMenus = (
  input: InternalRegisterWorkbenchExtensionContributionsInput,
  context: WorkbenchExtensionCommandContext,
) => {
  if (!input.menuSlotsById) return [] as Disposable[];
  const registrations = buildWorkbenchExtensionMenuRegistrations({
    metadata: input.metadata,
    menuSlotsById: input.menuSlotsById,
    menuTargetsById: input.menuTargetsById,
    createWhenExpression: input.createMenuWhenExpression,
  }).map(({ menuItem, menuPath, ...registration }) => ({
    ...registration,
    menuItems: [{ menuItem, menuPath }],
  }));
  const resolvedRegistrations = input.menuRegistrations ?? registrations;

  return resolvedRegistrations.flatMap((registration) => [
    input.workbench.commands.registerCommand(registration.command, {
      prepareArgs: (args, executionContext, onArgsChange) =>
        prepareCommandArgs(context, registration.targetCommandId, args, executionContext, onArgsChange),
      execute: (args, executionContext) =>
        executeWorkbenchExtensionCommand(context, registration.targetCommandId, {
          params: { ...(registration.contribution.params ?? {}), ...(asParams(args) ?? {}) },
          resource: menuCommandResource(input, executionContext),
          slot: createExtensionSlot({
            id: registration.contribution.slotId,
            kind: "menu",
            projectId: input.projectId,
            context: { panelId: registration.contribution.id },
          }),
        }),
    }),
    ...registration.menuItems.map(({ menuPath, menuItem }) =>
      input.workbench.layout.registerMenuItem(menuPath, menuItem),
    ),
  ]);
};

const registerCommandPaletteContributions = (
  input: InternalRegisterWorkbenchExtensionContributionsInput,
  context: WorkbenchExtensionCommandContext,
) => {
  const registrations = buildWorkbenchExtensionCommandPaletteRegistrations({ metadata: input.metadata });

  return registrations.flatMap((registration) => [
    input.workbench.commands.registerCommand(registration.command, {
      prepareArgs: (args, executionContext, onArgsChange) =>
        prepareCommandArgs(context, registration.targetCommandId, args, executionContext, onArgsChange),
      execute: (args, executionContext) =>
        executeWorkbenchExtensionCommand(context, registration.targetCommandId, {
          params: { ...(registration.contribution.params ?? {}), ...(asParams(args) ?? {}) },
          resource: menuCommandResource(input, executionContext),
          slot: createExtensionSlot({
            id: "workbench.commandPalette",
            kind: "menu",
            projectId: input.projectId,
            context: { panelId: registration.contribution.id },
          }),
        }),
      isVisible: () => matchesResourceWhen(registration.contribution.when, input.workbench.getPrimaryResource()?.kind),
    }),
    input.workbench.layout.registerMenuItem(workbenchCommandPaletteMenuPath, registration.menuItem),
  ]);
};

const matchesActiveMode = (
  input: InternalRegisterWorkbenchExtensionContributionsInput,
  when: { mode?: string | string[] } | undefined,
) => {
  const modes = when?.mode;
  if (!modes) return true;
  const active = input.workbench.modes.getActiveModeId() ?? "";
  return Array.isArray(modes) ? modes.includes(active) : modes === active;
};

const registerStatusBarItems = (input: InternalRegisterWorkbenchExtensionContributionsInput) =>
  (input.metadata.statusBarItems ?? []).map((item) =>
    input.workbench.statusBar.registerItem({
      id: item.id,
      viewId: item.viewId,
      slot: item.slot,
      order: item.order,
      isVisible: () => matchesActiveMode(input, item.when as { mode?: string | string[] } | undefined),
    }),
  );

export const registerWorkbenchExtensionContributions = (sourceInput: RegisterWorkbenchExtensionContributionsInput) => {
  const input: InternalRegisterWorkbenchExtensionContributionsInput = {
    ...sourceInput,
    metadata: toInternalWorkbenchExtensionMetadata(sourceInput.metadata),
  };
  const disposables: Disposable[] = [];
  const context: WorkbenchExtensionCommandContext = input;

  disposables.push(...registerBridgeRenderer(input));
  disposables.push(...registerCommands(context, input.metadata));
  disposables.push(
    ...registerWorkbenchExtensionKeybindings({
      bindings: input.metadata.keybindings,
      createWhenExpression: input.createKeybindingWhenExpression,
      workbench: input.workbench,
    }),
  );
  disposables.push(...registerMenus(input, context));
  disposables.push(...registerCommandPaletteContributions(input, context));
  disposables.push(
    registerWorkbenchExtensionTreeRenderers({ ...input, resolveNodeResource: input.resolveTreeNodeResource }),
  );
  disposables.push(registerWorkbenchExtensionFileRenderers(input));
  disposables.push(
    registerWorkbenchExtensionControlsRenderers(
      context,
      input.metadata.controlsRenderers ?? [],
      input.metadata.panels,
      { resolveViewInput: input.resolveViewInput },
      input.metadata.resourcePanels,
    ),
  );
  disposables.push(...registerWebviewPanels(input));
  disposables.push(...registerSettings(input));
  // Status-backed renderers query their provider while they register. Providers
  // must exist first so the renderer's live option source can load immediately.
  disposables.push(...registerStatuses(input, context));
  disposables.push(
    registerWorkbenchExtensionKanbanRenderers(
      context,
      input.metadata.kanbanRenderers ?? [],
      { ...input.kanbanAdapter, resolveViewInput: input.resolveViewInput },
      input.metadata.panels,
      input.metadata.resourcePanels,
    ),
  );
  disposables.push(
    registerWorkbenchExtensionDataTableRenderers(
      context,
      input.metadata.dataTableRenderers ?? [],
      input.metadata.panels,
      input.metadata.resourcePanels,
      input.resolveViewInput,
    ),
  );
  disposables.push(
    registerWorkbenchExtensionCommandPaletteResources(context, input.metadata.commandPaletteResources ?? []),
  );
  disposables.push(
    ...registerWorkbenchExtensionNavigationItems({
      metadata: sourceInput.metadata,
      workbench: sourceInput.workbench,
    }),
  );
  if (sourceInput.subscribeRefreshEvents) {
    disposables.push(
      registerWorkbenchExtensionRendererRefreshEvents({
        metadata: sourceInput.metadata,
        subscribe: sourceInput.subscribeRefreshEvents,
        workbench: sourceInput.workbench,
      }),
    );
  }
  disposables.push(...registerStatusBarItems(input));
  disposables.push(...registerResourcePresenters(input));
  const composition = registerComposition(input);
  disposables.push(...composition.disposables);
  disposables.push(...registerModes(input, composition.registry));

  return {
    dispose() {
      disposeAll(disposables);
    },
  };
};
