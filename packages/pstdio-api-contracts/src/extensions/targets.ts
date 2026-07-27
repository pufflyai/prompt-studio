import { z } from "zod";
import {
  workbenchMenuTargets,
  workbenchModeLayoutTargets,
  workbenchRegions,
  workbenchSettingsScopes,
  workbenchSettingsTargets,
  workbenchTreeTargets,
  workbenchViewTargets,
} from "../extension-kernel/workbench-targets";

export const workbenchMenuTargetSchema = z.enum(workbenchMenuTargets);
export const workbenchTreeTargetSchema = z.enum(workbenchTreeTargets);
export const workbenchRegionSchema = z.enum(workbenchRegions);
export const workbenchViewTargetSchema = z.enum(workbenchViewTargets);
export const workbenchSettingsTargetSchema = z.enum(workbenchSettingsTargets);
export const workbenchModeLayoutTargetSchema = z.enum(workbenchModeLayoutTargets);
export const workbenchAttachmentTargetSchema = z.union([
  workbenchMenuTargetSchema,
  workbenchTreeTargetSchema,
  workbenchViewTargetSchema,
  workbenchSettingsTargetSchema,
]);
export const workbenchSettingsScopeSchema = z.enum(workbenchSettingsScopes);
