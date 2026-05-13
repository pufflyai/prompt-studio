import type { ActivityKindContribution, ActivityRegistry } from "../activity/activity-registry";
import type { CommandRegistry } from "../commands/command-registry";
import type { DiagnosticRegistry } from "../diagnostics/diagnostic-registry";
import type { Disposable } from "../disposable";
import type { KeybindingRegistry } from "../keybindings/keybinding-registry";
import type { LayoutModel, ShellArea, ShellAreaSize, WebviewDescriptor } from "../layout/layout-model";
import type { MenuPath, MenuRegistry } from "../menus/menu-registry";
import type { PreferenceRegistry, PreferenceSchemaContribution } from "../preferences/preference-registry";
import type { ResourceRegistry } from "../resources/resource-registry";
import type { WebviewRegistry } from "../webviews/webview-registry";

interface RuntimeResourceKindDescriptor {
  kind: string;
  label: string;
  icon?: string;
}

interface RuntimeCommandDescriptor {
  title: string;
  category?: string;
  description?: string;
  icon?: string;
  run(args?: unknown): unknown | Promise<unknown>;
}

interface RuntimeViewDescriptor {
  title: string;
  slot: string;
  areaSize?: ShellAreaSize;
  areaCollapsible?: boolean;
  resourceKinds?: string[];
  webview: WebviewDescriptor;
}

interface RuntimeMenuContribution {
  path: MenuPath;
  command: string;
  label?: string;
  icon?: string;
  when?: string;
  group?: string;
  order?: number;
  args?: unknown;
}

interface RuntimeKeybindingContribution {
  command: string;
  keybinding: string;
  when?: string;
  args?: unknown;
}

interface RuntimeActivityContribution {
  kinds?: Record<string, ActivityKindContribution>;
}

interface RuntimeDiagnosticSourceDescriptor {
  title: string;
  icon?: string;
}

interface RuntimeDiagnosticsContribution {
  sources?: Record<string, RuntimeDiagnosticSourceDescriptor>;
}

export interface RuntimeExtensionContributionDescriptor {
  resources?: Record<string, RuntimeResourceKindDescriptor>;
  commands?: Record<string, RuntimeCommandDescriptor>;
  views?: Record<string, RuntimeViewDescriptor>;
  menus?: RuntimeMenuContribution[];
  keybindings?: RuntimeKeybindingContribution[];
  preferences?: PreferenceSchemaContribution;
  activity?: RuntimeActivityContribution;
  diagnostics?: RuntimeDiagnosticsContribution;
}

export interface RuntimeExtensionAdapterInput {
  extensionId: string;
  packageName: string;
  displayName: string;
  contributions: RuntimeExtensionContributionDescriptor;
}

interface RuntimeExtensionAdapterRegistries {
  activity?: ActivityRegistry;
  commands: CommandRegistry;
  diagnostics?: DiagnosticRegistry;
  keybindings?: KeybindingRegistry;
  layout: LayoutModel;
  menus: MenuRegistry;
  preferences?: PreferenceRegistry;
  resources: ResourceRegistry;
  webviews?: WebviewRegistry;
}

const reservedCommandPrefixes = new Set(["shell", "resource", "widget", "layout", "commands", "preferences"]);
const shellAreaBySlot = new Set<string>([
  "top",
  "activityBar",
  "left",
  "main-header",
  "main-left",
  "main",
  "main-right",
  "main-bottom",
  "status",
  "overlay",
  "floating-header",
  "floating",
]);

const extensionMetadata = (extensionId: string) => ({
  source: "extension" as const,
  ownerId: extensionId,
});

type ExtensionContributionMetadata = ReturnType<typeof extensionMetadata>;

const assertRuntimeCommandKey = (localId: string) => {
  const prefix = localId.split(".")[0];
  if (prefix && reservedCommandPrefixes.has(prefix)) {
    throw new Error(`Runtime extensions cannot contribute reserved command prefix: ${localId}`);
  }
};

const normalizeExtensionScopedId = (packageName: string, localId: string) =>
  localId.startsWith(`${packageName}.`) ? localId : `${packageName}.${localId}`;

const shellAreaForSlot = (slot: string) => (shellAreaBySlot.has(slot) ? (slot as ShellArea) : "main");

const registerRuntimeView = (
  registries: RuntimeExtensionAdapterRegistries,
  packageName: string,
  localId: string,
  view: RuntimeViewDescriptor,
  metadata: ExtensionContributionMetadata,
) => {
  const widgetId = normalizeExtensionScopedId(packageName, localId);
  const disposables = [
    registries.layout.registerWidget(
      {
        id: widgetId,
        title: view.title,
        area: shellAreaForSlot(view.slot),
        areaSize: view.areaSize,
        areaCollapsible: view.areaCollapsible,
        resourceKinds: view.resourceKinds,
        renderer: "webview",
        webview: view.webview,
      },
      metadata,
    ),
  ];

  if (registries.webviews) {
    disposables.push(
      registries.webviews.registerWebview(
        {
          ...view.webview,
          id: widgetId,
          title: view.webview.title ?? view.title,
        },
        metadata,
      ),
    );
  }

  return disposables;
};

const registerRuntimeKeybinding = (
  registries: RuntimeExtensionAdapterRegistries,
  packageName: string,
  keybinding: RuntimeKeybindingContribution,
  metadata: ExtensionContributionMetadata,
) => {
  if (!registries.keybindings) return [];

  return [
    registries.keybindings.registerKeybinding(
      {
        commandId: normalizeExtensionScopedId(packageName, keybinding.command),
        keybinding: keybinding.keybinding,
        when: keybinding.when,
        args: keybinding.args,
      },
      metadata,
    ),
  ];
};

const registerRuntimeActivityKind = (
  registries: RuntimeExtensionAdapterRegistries,
  activityKind: ActivityKindContribution,
  metadata: ExtensionContributionMetadata,
) => (registries.activity ? [registries.activity.registerKind(activityKind, metadata)] : []);

const registerRuntimeDiagnosticSource = (
  registries: RuntimeExtensionAdapterRegistries,
  packageName: string,
  source: string,
  diagnosticSource: RuntimeDiagnosticSourceDescriptor,
  metadata: ExtensionContributionMetadata,
) =>
  registries.diagnostics
    ? [
        registries.diagnostics.registerSource(
          {
            source: normalizeExtensionScopedId(packageName, source),
            ...diagnosticSource,
          },
          metadata,
        ),
      ]
    : [];

export const adaptRuntimeExtensionContributions = (
  registries: RuntimeExtensionAdapterRegistries,
  input: RuntimeExtensionAdapterInput,
) => {
  const disposables: Disposable[] = [];
  const metadata = extensionMetadata(input.extensionId);

  for (const resource of Object.values(input.contributions.resources ?? {})) {
    disposables.push(registries.resources.registerKind(resource, metadata));
  }

  for (const [localId, command] of Object.entries(input.contributions.commands ?? {})) {
    assertRuntimeCommandKey(localId);
    const commandId = normalizeExtensionScopedId(input.packageName, localId);

    disposables.push(
      registries.commands.registerCommand(
        {
          id: commandId,
          label: command.title,
          category: command.category,
          description: command.description,
          icon: command.icon,
        },
        {
          execute: (args) => command.run(args),
        },
        metadata,
      ),
    );
  }

  for (const [localId, view] of Object.entries(input.contributions.views ?? {})) {
    disposables.push(...registerRuntimeView(registries, input.packageName, localId, view, metadata));
  }

  for (const menu of input.contributions.menus ?? []) {
    disposables.push(
      registries.menus.registerMenuAction(
        menu.path,
        {
          commandId: normalizeExtensionScopedId(input.packageName, menu.command),
          label: menu.label,
          icon: menu.icon,
          when: menu.when,
          group: menu.group,
          order: menu.order,
          args: menu.args,
        },
        metadata,
      ),
    );
  }

  for (const keybinding of input.contributions.keybindings ?? []) {
    disposables.push(...registerRuntimeKeybinding(registries, input.packageName, keybinding, metadata));
  }

  if (input.contributions.preferences && registries.preferences) {
    disposables.push(registries.preferences.registerSchema(input.contributions.preferences, metadata));
  }

  for (const activityKind of Object.values(input.contributions.activity?.kinds ?? {})) {
    disposables.push(...registerRuntimeActivityKind(registries, activityKind, metadata));
  }

  for (const [source, diagnosticSource] of Object.entries(input.contributions.diagnostics?.sources ?? {})) {
    disposables.push(
      ...registerRuntimeDiagnosticSource(registries, input.packageName, source, diagnosticSource, metadata),
    );
  }

  return {
    dispose() {
      for (let index = disposables.length - 1; index >= 0; index -= 1) {
        disposables[index]?.dispose();
      }
    },
  };
};
