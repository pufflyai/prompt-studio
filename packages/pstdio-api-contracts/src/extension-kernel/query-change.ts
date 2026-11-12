import { z } from "zod";

/** Known source scope narrows invalidation; absent scope remains conservative. */
export interface QueryDependency {
  projectId?: string;
  extensionId?: string;
  recordId?: string;
  /** Any of these records can change a compound finite source. */
  recordIds?: readonly string[];
  resourceKey?: string;
  resourceId?: string;
  fields?: readonly string[];
}

/** Public invalidation metadata only. Event payloads and document values never enter this envelope. */
export const queryChangeEnvelopeSchema = z.object({
  projectId: z.string().optional(),
  extensionId: z.string().optional(),
  /** Opaque structured-storage record identities, distinct from public resource IDs. */
  recordIds: z.array(z.string()).max(128).optional(),
  resourceKey: z.string().optional(),
  resourceKeys: z.array(z.string()).optional(),
  resourceIds: z.array(z.string()).optional(),
  changedFields: z.array(z.string()).optional(),
  changes: z
    .array(z.object({ resourceId: z.string(), changedFields: z.array(z.string()), membership: z.boolean().optional() }))
    .optional(),
  membership: z.boolean().optional(),
});
