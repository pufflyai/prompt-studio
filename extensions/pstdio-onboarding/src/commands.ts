import { defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { detectHarnesses } from "./detect-harnesses";
import { createSetupState } from "./state";
import { updateOnboardingSchema } from "./types";

const state = createSetupState();
export const commands = {
  preferences: defineCommand({
    id: "preferences",
    title: l10n("commands.preferences", "Read onboarding preferences"),
    cli: true,
    run: (ctx) => state.read(ctx),
  }),
  read: defineCommand({
    id: "read",
    cli: true,
    title: l10n("commands.read", "Read onboarding choices"),
    run: async (ctx) => {
      if (!ctx.extensions) throw new Error("This host does not support extension management.");
      const [saved, detectedHarnesses, inventory] = await Promise.all([
        state.read(ctx),
        detectHarnesses(ctx.process),
        ctx.extensions.list(),
      ]);
      return {
        info: {
          state: saved,
          detectedHarnesses,
          installedExtensions: [...new Set(inventory.extensions.map((entry) => entry.extensionId))],
          platform: process.platform,
        },
        inventory,
      };
    },
  }),
  update: defineCommand({
    id: "update",
    cli: true,
    title: l10n("commands.update", "Save onboarding choices"),
    mutating: true,
    params: { request: params.json({ required: true }) },
    run: (ctx, input) => state.update(ctx, updateOnboardingSchema.parse(input.request)),
  }),
};
