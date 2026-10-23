import { z } from "zod";

export const sessionSteeringInputSchema = z
  .object({
    expectedRunStartedAt: z.string().min(1),
    prompt: z.string().min(1).optional(),
    summaryFromSessionId: z.string().optional(),
    summaryFormat: z.enum(["brief", "detailed"]).optional(),
    summaryRole: z.enum(["assistant", "all"]).optional(),
    attachments: z.array(z.object({ fileId: z.string().min(1) }).strict()).optional(),
  })
  .strict()
  .refine((input) => input.prompt || input.summaryFromSessionId, {
    message: "A prompt or source session summary is required.",
  });

export type SessionSteeringInput = z.infer<typeof sessionSteeringInputSchema>;
