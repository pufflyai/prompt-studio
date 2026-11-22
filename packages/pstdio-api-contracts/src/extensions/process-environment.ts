import { z } from "zod";

const variableNameSchema = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/);

/** What an extension source requests from the host environment and what the user allowed. Never values. */
export const extensionProcessEnvironmentPermissionSchema = z.object({
  extensionId: z.string(),
  projectId: z.string(),
  /** The installed source content the grant applies to. A grant for other content no longer applies. */
  sourceIdentity: z.string(),
  /** Names in the source's `pstdio.processEnvironment`. */
  requested: z.array(z.string()),
  /** Requested names the user allowed for this source and project. */
  granted: z.array(z.string()),
  /** A grant exists for earlier source content and must be given again. */
  stale: z.boolean(),
});

export const grantExtensionProcessEnvironmentSchema = z.object({
  names: z.array(variableNameSchema).min(1),
  /** The `sourceIdentity` the person saw when choosing names. */
  sourceIdentity: z.string().min(1),
});

export type ExtensionProcessEnvironmentPermission = z.infer<typeof extensionProcessEnvironmentPermissionSchema>;
export type GrantExtensionProcessEnvironmentInput = z.infer<typeof grantExtensionProcessEnvironmentSchema>;
