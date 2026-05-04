import type { CommandRef, CommandSource } from "./commands";
import type { JsonObject, Struct } from "./json";
import type { PackageAssetDescriptor } from "./resources";
import type { SlotRef } from "./slots";

export interface CliContribution {
  path?: string[];
  globalAliases?: string[][];
  description?: string;
  examples?: string[];
  hidden?: boolean;
}

export interface WhenExpression {
  source?: CommandSource[];
  resourceType?: string[];
  metadata?: JsonObject;
}

export interface CommandPanelContribution {
  group?: string;
  keywords?: string[];
  when?: WhenExpression;
}

export interface MenuContribution<TSlotContext extends Struct = Struct, TParams extends Struct = Struct> {
  slot: SlotRef<TSlotContext, "menu"> | string;
  label?: string;
  group?: string;
  placement?: "first" | "default" | "last";
  icon?: string;
  when?: WhenExpression;
  command?: CommandRef<TParams, unknown> | string;
  params?: Partial<TParams>;
  presentation?: "menu-item" | "button" | "icon-button";
}

export interface NavigationContribution<TSlotContext extends Struct = Struct, TParams extends Struct = Struct> {
  slot: SlotRef<TSlotContext, "navigation"> | string;
  label: string;
  group?: string;
  placement?: "first" | "default" | "last";
  route?: string;
  href?: string;
  command?: CommandRef<TParams, unknown> | string;
  params?: Partial<TParams>;
  icon?: string;
  when?: WhenExpression;
}

export interface WebviewContribution {
  entry: PackageAssetDescriptor;
  title?: string;
  sandbox?: "default" | "strict";
}

export interface ViewContribution<TSlotContext extends Struct = Struct> {
  title: string;
  slot: SlotRef<TSlotContext, "view"> | string;
  group?: string;
  placement?: "first" | "default" | "last";
  webview: WebviewContribution;
}

export interface RouteContribution {
  path: string;
  label: string;
  webview: WebviewContribution;
}

export interface SettingsPanelContribution<TSlotContext extends Struct = Struct> {
  title: string;
  slot: SlotRef<TSlotContext, "settings"> | string;
  webview: WebviewContribution;
}

export interface RendererContribution<TSlotContext extends Struct = Struct> {
  slot: SlotRef<TSlotContext, "renderer"> | string;
  for: string;
  webview: WebviewContribution;
}

export interface ArtifactMountContribution {
  /** Relative path under .pstdio/<extension.namespace>/. */
  path: string;
  label: string;
  repoRole?: "default" | "selected" | "workspace";
}

export interface TemplateTypeContribution {
  label: string;
  description?: string;
}

export interface TemplateContribution {
  title: string;
  type: string;
  source: PackageAssetDescriptor;
  description?: string;
}

export interface SkillContribution {
  title: string;
  source: PackageAssetDescriptor;
  description?: string;
}
