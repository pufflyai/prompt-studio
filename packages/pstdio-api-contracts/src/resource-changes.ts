import { z } from "zod";
import { extensionResourceRefSchema } from "./extensions/resource-ref";

export const changeStampSchema = z.object({
  lineage: z.string().min(1).max(256),
  revision: z.string().regex(/^(0|[1-9][0-9]{0,39})$/),
});
export type ChangeStamp = z.infer<typeof changeStampSchema>;
export const changeHeadSchema = z.object({ resource: extensionResourceRefSchema, stamp: changeStampSchema });
export type ChangeHead = z.infer<typeof changeHeadSchema>;
export type ChangeIndicator = ChangeHead & { changedSinceSeen: boolean };
export type ObservedResource = { content: unknown; stamp: ChangeStamp; receipt: string };
