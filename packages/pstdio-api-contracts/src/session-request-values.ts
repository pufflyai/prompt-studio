import { z } from "zod";

export const harnessParamValueSchema = z.union([z.string(), z.boolean()]);
export const harnessParamsInputSchema = z.record(z.string(), harnessParamValueSchema);
export const sessionAttachmentRefSchema = z.object({ file_id: z.string().min(1) });
