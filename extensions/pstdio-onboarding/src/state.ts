import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { type OnboardingState, onboardingExtensions, onboardingStateSchema, type UpdateOnboarding } from "./types";

const initial = { completed: false, hidden: false, harnesses: null, workAreas: null } satisfies OnboardingState;
export const createSetupState = () => {
  const read = async (ctx: ExtensionContextBase) =>
    onboardingStateSchema.parse({
      ...onboardingStateSchema.omit({ hidden: true }).parse((await ctx.settings.get("choices")) ?? initial),
      hidden: (await ctx.settings.get("hidden")) ?? false,
    });
  let pending: Promise<unknown> = Promise.resolve();
  const update = (ctx: ExtensionContextBase, request: UpdateOnboarding) => {
    const operation = pending.then(async () => {
      const current = await read(ctx);
      if (request.step === "visibility") {
        await ctx.settings.set("hidden", request.hidden);
        return { ...current, hidden: request.hidden };
      }
      let state = current;
      let names: string[] | undefined;
      if (request.step === "harnesses") {
        const harnesses = [...new Set(request.harnesses)];
        state = { ...current, harnesses };
        names = harnesses.map((id) => `harness-${id}`);
      } else if (request.step === "complete") {
        const workAreas = [...new Set(request.workAreas)];
        state = { ...current, completed: true, workAreas };
        names = onboardingExtensions(workAreas);
      } else state = { ...current, completed: true };
      if (names) {
        if (!ctx.extensions) throw new Error("This host does not support extension installation.");
        await ctx.extensions.install(names);
      }
      const { hidden, ...choices } = state;
      await ctx.settings.set("choices", choices);
      return { ...choices, hidden };
    });
    pending = operation.catch(() => {});
    return operation;
  };
  return { read, update };
};
