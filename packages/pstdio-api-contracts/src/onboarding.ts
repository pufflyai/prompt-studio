import { z } from "zod";

export const onboardingHarnessSchema = z.enum(["codex", "open-code", "claude-code", "pi"]);
export const onboardingWorkAreaSchema = z.enum(["coding", "planning"]);
export const onboardingStateSchema = z.object({
  completed: z.boolean(),
  hidden: z.boolean(),
  harnesses: z.array(onboardingHarnessSchema).nullable(),
  workAreas: z.array(onboardingWorkAreaSchema).nullable(),
});
export const updateOnboardingSchema = z.discriminatedUnion("step", [
  z.object({ step: z.literal("skip") }).strict(),
  z.object({ step: z.literal("visibility"), hidden: z.boolean() }).strict(),
  z.object({ step: z.literal("harnesses"), harnesses: z.array(onboardingHarnessSchema) }).strict(),
  z.object({ step: z.literal("complete"), workAreas: z.array(onboardingWorkAreaSchema) }).strict(),
]);
export const onboardingInfoSchema = z.object({
  state: onboardingStateSchema,
  detectedHarnesses: z.array(onboardingHarnessSchema),
  platform: z.string(),
});
export type OnboardingHarness = z.infer<typeof onboardingHarnessSchema>;
export type OnboardingWorkArea = z.infer<typeof onboardingWorkAreaSchema>;
export type OnboardingState = z.infer<typeof onboardingStateSchema>;
export type OnboardingInfo = z.infer<typeof onboardingInfoSchema>;
export type UpdateOnboarding = z.infer<typeof updateOnboardingSchema>;

export const onboardingExtensions = (workAreas: readonly OnboardingWorkArea[]) => {
  const extensions = new Set<string>();
  if (workAreas.includes("coding")) {
    for (const name of ["pstdio-planner", "pstdio-reports", "pstdio-artifacts"]) extensions.add(name);
  }
  if (workAreas.includes("planning")) {
    for (const name of ["pstdio-planner", "pstdio-notes", "pstdio-reports"]) extensions.add(name);
  }
  return [...extensions, "pstdio-base-themes", "pstdio-skills"];
};
