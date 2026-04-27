import { z } from "@hono/zod-openapi";
import {
  createHarnessSessionInputSchema,
  harnessConfigSchema,
  harnessInfoSchema,
  harnessModelSchema,
  sendHarnessSessionInputSchema,
  setupAvailableHarnessesInputSchema,
  setupHarnessInputSchema,
  updateHarnessInputSchema,
} from "pstdio-api-contracts";
import { sessionResponseSchema } from "../sessions/dto";

export const harnessConfigResponseSchema = harnessConfigSchema;
export const harnessConfigListResponseSchema = z.array(harnessConfigResponseSchema);
export const harnessInfoResponseSchema = harnessInfoSchema;
export const harnessInfoListResponseSchema = z.array(harnessInfoResponseSchema);
export const harnessModelsListResponseSchema = z.array(harnessModelSchema);

export const setupHarnessBodySchema = setupHarnessInputSchema.strict();
export const setupAvailableHarnessesBodySchema = setupAvailableHarnessesInputSchema.strict();
export const updateHarnessBodySchema = updateHarnessInputSchema.strict();

export const createHarnessSessionBodySchema = createHarnessSessionInputSchema
  .strict()
  .refine((data) => data.prompt || data.template, {
    message: "At least one of 'prompt' or 'template' is required.",
  })
  .refine((data) => !(data.prompt && data.template), {
    message: "--prompt and --template are mutually exclusive",
  });

export const sendHarnessSessionBodySchema = sendHarnessSessionInputSchema
  .strict()
  .refine((data) => data.prompt || data.template || data.summary_from_session_id, {
    message: "At least one of 'prompt', 'template', or 'summary_from_session_id' is required.",
  })
  .refine((data) => !(data.prompt && data.template), {
    message: "--prompt and --template are mutually exclusive",
  });

export const sessionResponse = sessionResponseSchema;
export const notFoundResponseSchema = z.object({ error: z.string() });
