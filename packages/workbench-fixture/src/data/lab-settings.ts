import type { ExtensionSettingsContribution } from "@pstdio/sdk/extensions";

export const labSettings = {
  properties: {
    "counter.step": {
      type: "number",
      scope: "project",
      default: 1,
      title: "Counter step",
      description: "Increment size used by the counter command.",
    },
    "counter.enabled": {
      type: "boolean",
      scope: "project",
      default: true,
      title: "Enable counter",
    },
    "greeting.tone": {
      type: "string",
      scope: "global",
      enum: ["friendly", "formal"],
      default: "friendly",
      title: "Greeting tone",
    },
    "model.default": {
      type: "string",
      scope: "global",
      default: "claude-sonnet-4",
      title: "Default model",
    },
  },
} as const satisfies ExtensionSettingsContribution;
