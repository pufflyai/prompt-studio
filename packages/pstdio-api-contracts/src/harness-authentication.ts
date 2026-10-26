import { z } from "zod";

export const harnessAuthenticationStatusSchema = z.enum(["signed_in", "signed_out", "not_required", "unknown"]);
export const harnessAuthenticationMethodSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(["oauth", "api_key"]),
});
export const harnessAuthenticationProviderSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: harnessAuthenticationStatusSchema,
  methods: z.array(harnessAuthenticationMethodSchema),
  canLogout: z.boolean(),
});
export const harnessAuthenticationSchema = z.object({
  status: harnessAuthenticationStatusSchema,
  provider: z.string().optional(),
  providers: z.array(harnessAuthenticationProviderSchema),
});
export const harnessAuthenticationInputSchema = z.object({
  action: z.enum(["login", "logout"]),
  model: z.string().optional(),
  provider: z.string().optional(),
  method: z.string().optional(),
});
export const harnessAuthenticationPromptSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("browser"),
    url: z.url().refine((value) => ["https:", "http:"].includes(new URL(value).protocol)),
    code: z.string().optional(),
    message: z.string().optional(),
  }),
  z.object({
    type: z.literal("select"),
    title: z.string(),
    options: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
          description: z.string().optional(),
          kind: z.enum(["oauth", "api_key"]).optional(),
        }),
      )
      .min(1),
    initial: z.string().optional(),
  }),
  z.object({ type: z.literal("input"), title: z.string(), secret: z.boolean(), placeholder: z.string().optional() }),
  z.object({ type: z.literal("message"), message: z.string() }),
]);
export const harnessAuthenticationClientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("open"),
    agent: z.string().min(1),
    projectId: z.string().min(1).optional(),
    input: harnessAuthenticationInputSchema,
  }),
  z.object({ type: z.literal("reply"), requestId: z.string(), value: z.string().max(65536) }),
  z.object({ type: z.literal("cancel") }),
]);
export type HarnessAuthentication = z.infer<typeof harnessAuthenticationSchema>;
export type HarnessAuthenticationProvider = z.infer<typeof harnessAuthenticationProviderSchema>;
export type HarnessAuthenticationInput = z.infer<typeof harnessAuthenticationInputSchema>;
export type HarnessAuthenticationPrompt = z.infer<typeof harnessAuthenticationPromptSchema>;
export type HarnessAuthenticationQuestion = Extract<HarnessAuthenticationPrompt, { type: "input" | "select" }>;
export type HarnessAuthenticationClientMessage = z.infer<typeof harnessAuthenticationClientMessageSchema>;
export const harnessAuthenticationServerMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("prompt"), prompt: harnessAuthenticationPromptSchema, requestId: z.string().optional() }),
  z.object({ type: z.literal("completed") }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);
export type HarnessAuthenticationServerMessage = z.infer<typeof harnessAuthenticationServerMessageSchema>;

/** A live account flow. Replies travel only on this channel, outside commands, events and conversation history. */
export interface HarnessAuthenticationChannel {
  signal: AbortSignal;
  emit(prompt: Exclude<HarnessAuthenticationPrompt, HarnessAuthenticationQuestion>): Promise<void>;
  request(prompt: HarnessAuthenticationQuestion): Promise<string>;
}
