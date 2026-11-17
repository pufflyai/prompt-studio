import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { type OnboardingState, onboardingExtensions, onboardingStateSchema, type UpdateOnboarding } from "./types";

const availableOnboardingExtensions = async (
  extensions: NonNullable<ExtensionContextBase["extensions"]>,
  names: string[],
) => {
  if (!names.includes("pstdio-skill-browser")) return names;
  const inventory = await extensions.list();
  const available = inventory.marketplace.find((entry) => entry.extensionId === "pstdio.pstdio-skill-browser");
  if (!available) return names.filter((name) => name !== "pstdio-skill-browser");
  return names.map((name) => (name === "pstdio-skill-browser" ? available.installName : name));
};

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
        await ctx.extensions.install(await availableOnboardingExtensions(ctx.extensions, names));
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
