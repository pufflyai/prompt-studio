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
import type {
  InternalRegisterWorkbenchExtensionContributionsInput,
  RegisterWorkbenchExtensionContributionsInput,
} from "./workbench-extension-host-types";
import { registerWorkbenchExtensionKeybindings } from "./workbench-extension-keybindings";

export type { RegisterWorkbenchExtensionContributionsInput } from "./workbench-extension-host-types";

import { toInternalWorkbenchExtensionMetadata } from "./workbench-extension-metadata-adapter";
import { registerWorkbenchExtensionRendererRefreshEvents } from "./workbench-extension-refresh";
import {
  registerSettings,
  registerStatuses,
  registerViewMenus,
  registerWebviewPanels,
} from "./workbench-extension-surfaces";
import { createWorkbenchExtensionTabPresentation } from "./workbench-extension-tab-presentation";

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
  const { registrations } = buildWorkbenchExtensionMenuRegistrations({
    metadata: input.metadata,
    menuSlotsById: input.menuSlotsById,
    menuTargetsById: input.menuTargetsById,
    createWhenExpression: input.createMenuWhenExpression,
  });
  const defaultRegistrations = registrations.map(({ menuItem, menuPath, ...registration }) => ({
    ...registration,
    menuItems: [{ menuItem, menuPath }],
  }));
  const resolvedRegistrations = input.menuRegistrations ?? defaultRegistrations;
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
      isVisible: () => matchesResourceWhen(registration.contribution.when, input.workbench.getPrimaryResource()?.type),
    }),
    input.workbench.layout.registerMenuItem(workbenchCommandPaletteMenuPath, registration.menuItem),
  ]);
};
const matchesActiveMode = (
  input: InternalRegisterWorkbenchExtensionContributionsInput,
  when:
    | {
        mode?: string | string[];
      }
    | undefined,
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
      isVisible: () =>
        matchesActiveMode(
          input,
          item.when as
            | {
                mode?: string | string[];
              }
            | undefined,
        ),
    }),
  );
const registerPages = (input: InternalRegisterWorkbenchExtensionContributionsInput) =>
  input.metadata.pages.map((page) => input.workbench.pages.registerPage(page));
const registerResourceKinds = (input: InternalRegisterWorkbenchExtensionContributionsInput) =>
  input.metadata.resourceKinds.map((kind) =>
    input.workbench.resources.registerKind({
      kind: kind.id,
      label: text(kind.label, kind.id),
      icon: kind.icon ?? "FileText",
    }),
  );
const registerModes = (input: InternalRegisterWorkbenchExtensionContributionsInput) =>
  input.metadata.modes.map((mode) =>
    input.workbench.modes.registerMode({
      id: mode.modeId,
      label: text(mode.label, mode.modeId),
      panels: mode.panelRegions,
      regionSettings: mode.regionSettings,
      floatingPanels: mode.floatingPanels,
      defaultTheme: mode.defaultTheme,
      chrome: mode.chrome,
      activate: () => undefined,
    }),
  );
const registerModePlacements = (input: InternalRegisterWorkbenchExtensionContributionsInput) =>
  input.metadata.placements.map((placement) => input.workbench.modePlacements.registerPlacement(placement));
export const registerWorkbenchExtensionContributions = (sourceInput: RegisterWorkbenchExtensionContributionsInput) => {
  const input: InternalRegisterWorkbenchExtensionContributionsInput = {
    ...sourceInput,
    metadata: toInternalWorkbenchExtensionMetadata(sourceInput.metadata, {
      createTab: (metadata) => createWorkbenchExtensionTabPresentation(sourceInput, metadata),
    }),
  };
  const disposables: Disposable[] = [];
  const context: WorkbenchExtensionCommandContext = input;
  try {
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
    disposables.push(registerWorkbenchExtensionControlsRenderers(context, input.metadata.controlsRenderers ?? []));
    disposables.push(...registerWebviewPanels(input));
    disposables.push(...registerSettings(input));
    // Status-backed renderers query their provider while they register. Providers
    // must exist first so the renderer's live option source can load immediately.
    disposables.push(...registerStatuses(input, context));
    disposables.push(
      registerWorkbenchExtensionKanbanRenderers(context, input.metadata.kanbanRenderers ?? [], input.kanbanAdapter),
    );
    disposables.push(registerWorkbenchExtensionDataTableRenderers(context, input.metadata.dataTableRenderers ?? []));
    disposables.push(...registerViewMenus(input));
    disposables.push(
      registerWorkbenchExtensionCommandPaletteResources(context, input.metadata.commandPaletteResources ?? []),
    );
    disposables.push(
      ...registerWorkbenchExtensionNavigationItems({
        createWhenExpression: sourceInput.createNavigationWhenExpression,
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
    disposables.push(...registerResourceKinds(input));
    disposables.push(...registerPages(input));
    disposables.push(...registerModes(input));
    disposables.push(...registerModePlacements(input));
    return {
      dispose() {
        disposeAll(disposables);
      },
    };
  } catch (error) {
    disposeAll(disposables);
    throw error;
  }
};
