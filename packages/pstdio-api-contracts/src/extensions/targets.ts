import { z } from "zod";
import { workbenchModeLayoutTargets } from "../extension-kernel/workbench-targets";

export const workbenchMenuTargetSchema = z.enum(["workbench.nav.actions", "workbench.nav.overflow"]);
export const workbenchTreeTargetSchema = z.enum([
  "workbench.left.tree",
  "workbench.main.left.tree",
  "workbench.main.right.tree",
]);
export const workbenchViewTargetSchema = z.enum([
  "workbench.main",
  "workbench.main.left",
  "workbench.main.right",
  "workbench.secondary",
]);
export const workbenchSettingsTargetSchema = z.enum(["workbench.settings"]);
export const workbenchModeLayoutTargetSchema = z.enum(workbenchModeLayoutTargets);
export const workbenchAttachmentTargetSchema = z.union([
  workbenchMenuTargetSchema,
  workbenchTreeTargetSchema,
  workbenchViewTargetSchema,
  workbenchSettingsTargetSchema,
]);
export const workbenchSettingsScopeSchema = z.enum(["project", "global"]);
