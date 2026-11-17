import { contributionRefId, type RendererEventReference } from "@pstdio/sdk/extensions";
import {
  canonicalExtensionId,
  historicalContributionId,
  historicalExtensionId,
} from "pstdio-api-contracts/extension-host";
import { resolveEventReferenceId } from "pstdio-api-contracts/extension-kernel";
import type { ExtensionRuntime } from "../types/runtime";
import { privateHandlerId } from "./normalize/private-handlers";

const indexes = new WeakMap<ExtensionRuntime, ReadonlyMap<string, string>>();

const addPrivateAliases = (runtime: ExtensionRuntime, aliases: Map<string, string>) => {
  for (const handler of runtime.privateHandlers) {
    const parent = [...runtime.views, ...runtime.commandPaletteResources].find(
      (entry) => entry.id === handler.rendererId,
    );
    let previous: string | undefined;
    if (parent)
      previous = historicalContributionId({
        extensionId: parent.extensionId,
        kind: handler.rendererKind === "commandPaletteResource" ? "command-palette-resource" : "view",
        id: parent.localId,
      });
    if (handler.rendererKind === "textSource") {
      const owner = runtime.extensions.find((entry) => entry.id === handler.extensionId);
      const source = owner?.definition.textSources?.find(
        (entry) => `${owner.id}.text-source.${entry.id}` === handler.rendererId,
      );
      if (source)
        previous = historicalContributionId({ extensionId: handler.extensionId, kind: "text-source", id: source.id });
    }
    if (previous) aliases.set(privateHandlerId(previous, handler.rendererKind, handler.operation), handler.id);
  }
};

const addHookEventAliases = (runtime: ExtensionRuntime, aliases: Map<string, string>) => {
  for (const extension of runtime.extensions) {
    for (const hook of runtime.hooks) {
      const declared = extension.definition.hooks?.find(
        (item) => item.id === hook.localId && hook.extensionId === extension.id,
      );
      if (!declared) continue;
      const owner = canonicalExtensionId(declared.event.extensionId ?? extension.id);
      const historical = historicalExtensionId(owner);
      if (owner === historical || !runtime.extensions.some((provider) => provider.id === owner)) continue;
      aliases.set(resolveEventReferenceId({ ...declared.event, extensionId: historical }), hook.eventId);
    }
  }
};

const addEventAliases = (runtime: ExtensionRuntime, aliases: Map<string, string>) => {
  const add = (events: readonly RendererEventReference[] | undefined, extensionId: string) => {
    for (const event of events ?? []) {
      if (typeof event === "string") continue;
      const owner = canonicalExtensionId(event.extensionId ?? extensionId);
      const previous = historicalExtensionId(owner);
      if (owner !== previous && runtime.extensions.some((entry) => entry.id === owner))
        aliases.set(
          resolveEventReferenceId({ ...event, extensionId: previous }),
          resolveEventReferenceId({ ...event, extensionId: owner }),
        );
    }
  };
  for (const view of runtime.views) {
    const body = view.contribution.body;
    if ("refreshEvents" in body) add(body.refreshEvents, view.extensionId);
    if ("schemaRefreshEvents" in body) add(body.schemaRefreshEvents, view.extensionId);
  }
  for (const provider of runtime.commandPaletteResources)
    add(provider.contribution.refreshEvents, provider.extensionId);
  for (const placement of runtime.placements) add(placement.contribution.tab?.refreshEvents, placement.extensionId);
  for (const page of runtime.pages)
    for (const slot of page.contribution.slots) add(slot.tab?.refreshEvents, page.extensionId);
  addHookEventAliases(runtime, aliases);
};

/** Aliases exist only for loaded extensions and contributions. No opaque ID is split or prefix-rewritten. */
export const contributionAliases = (runtime: ExtensionRuntime) => {
  const existing = indexes.get(runtime);
  if (existing) return existing;
  const aliases = new Map<string, string>();
  const groups = {
    commands: "command",
    views: "view",
    pages: "page",
    modes: "mode",
    resourceKinds: "resource-kind",
    artifactMounts: "artifact-mount",
    connections: "connection",
    schedules: "schedule",
    templates: "template",
    templateTypes: "template-type",
    themes: "theme",
    fileIconThemes: "file-icon-theme",
    keybindings: "keybinding",
    placements: "placement",
    navigationItems: "navigation-item",
    navigationTrees: "navigation-tree",
    viewMenus: "view-menu",
    settingsPanels: "settings-panel",
    settingsSections: "settings-section",
    statusBarItems: "status-bar-item",
    commandPaletteResources: "command-palette-resource",
    skills: "skill",
    hooks: "hook",
    middlewares: "middleware",
  } as const;
  for (const [group, kind] of Object.entries(groups)) {
    for (const record of runtime[group as keyof typeof groups]) {
      const old = historicalContributionId({ extensionId: record.extensionId, kind, id: record.localId });
      if (old) aliases.set(old, record.id);
    }
  }
  addPrivateAliases(runtime, aliases);
  // Automation status is host-generated and may only be observed inside a webview.
  for (const extension of runtime.extensions) {
    const previous = historicalExtensionId(extension.id);
    if (previous !== extension.id)
      aliases.set(`${previous}.event.automation-run-changed`, `${extension.id}.event.automation-run-changed`);
  }
  for (const command of runtime.commands) {
    const old = historicalContributionId({ extensionId: command.extensionId, kind: "command", id: command.localId });
    if (old)
      for (const phase of ["requested", "started", "completed", "rejected", "failed"])
        aliases.set(`command.${phase}:${old}`, `command.${phase}:${command.id}`);
  }
  addEventAliases(runtime, aliases);
  // Some resource IDs predate typed contribution IDs. Construct those exact aliases from their declarations too.
  for (const kind of runtime.resourceKinds) {
    const historical = historicalExtensionId(kind.extensionId);
    if (historical !== kind.extensionId) aliases.set(`${historical}.${kind.localId}`, kind.id);
    aliases.set(contributionRefId({ extensionId: kind.extensionId, kind: "resource-kind", id: kind.localId }), kind.id);
  }
  indexes.set(runtime, aliases);
  return aliases;
};

export const canonicalRuntimeId = (runtime: ExtensionRuntime, id: string) => contributionAliases(runtime).get(id) ?? id;
