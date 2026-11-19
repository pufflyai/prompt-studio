import { z } from "zod";
import { localizableStringSchema } from "./common";

const providerIdentity = z.object({
  id: z.string(),
  localId: z.string(),
  extensionId: z.string(),
});

export const workbenchWorkspaceTypeRecordSchema = providerIdentity.extend({
  label: localizableStringSchema,
  icon: z.string().optional(),
});

export const workbenchHarnessRecordSchema = providerIdentity.extend({
  label: localizableStringSchema.optional(),
});
