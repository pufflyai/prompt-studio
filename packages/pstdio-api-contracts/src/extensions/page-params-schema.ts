import { z } from "zod";
import { validatePageParamDefinitions } from "../extension-kernel/page-params";

export const pageParamValueSchema = z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]);
export const pageParamDefinitionsSchema = z
  .record(
    z.string(),
    z.discriminatedUnion("type", [
      z
        .object({
          type: z.literal("string"),
          default: z.string().optional(),
          values: z.array(z.string()).readonly().optional(),
        })
        .strict(),
      z.object({ type: z.literal("number"), default: z.number().optional() }).strict(),
      z.object({ type: z.literal("boolean"), default: z.boolean().optional() }).strict(),
      z.object({ type: z.literal("string[]"), default: z.array(z.string()).readonly().optional() }).strict(),
    ]),
  )
  .superRefine((value, ctx) => {
    try {
      validatePageParamDefinitions(value);
    } catch (error) {
      ctx.addIssue({ code: "custom", message: String(error) });
    }
  });
