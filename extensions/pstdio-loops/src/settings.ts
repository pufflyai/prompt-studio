import type { ExtensionSettingsContribution } from "@pstdio/sdk/extensions";

export const DEFAULT_STATUS_IDS = {
  refine: "default-refine",
  ready: "default-ready",
  inProgress: "default-in-progress",
  blocked: "default-blocked",
  inReview: "default-in-review",
} as const;

const STATUS_SETTING_KEYS = {
  refine: "automations.status.refine",
  ready: "automations.status.ready",
  inProgress: "automations.status.inProgress",
  blocked: "automations.status.blocked",
  inReview: "automations.status.inReview",
} as const;

type StatusKey = keyof typeof DEFAULT_STATUS_IDS;

interface SettingsReader {
  get(key: string): Promise<unknown> | unknown;
}

export const readAutomationStatusIds = async (settings: SettingsReader) => {
  const entries = await Promise.all(
    (Object.keys(DEFAULT_STATUS_IDS) as StatusKey[]).map(async (key) => {
      const value = await settings.get(STATUS_SETTING_KEYS[key]);
      return [key, typeof value === "string" && value.length > 0 ? value : DEFAULT_STATUS_IDS[key]] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<StatusKey, string>;
};

// Project-scoped knobs. `enabled` defaults to off so no autonomous behavior
// runs until an operator opts the project in; `maxInProgress` bounds the
// implementation loop so a sleeping repo cannot run up bills.
export const automationsSettings = {
  properties: {
    "automations.enabled": {
      type: "boolean",
      scope: "project",
      default: false,
      title: "Enable planner automations",
      description: "Run autonomous refinement, implementation, review, and stuck-work sweeps for this project.",
    },
    "automations.maxInProgress": {
      type: "number",
      scope: "project",
      default: 5,
      title: "Maximum tickets in progress",
      description: "Implementation loop stops picking new tickets once In Progress reaches this count.",
    },
    "automations.status.refine": {
      type: "string",
      scope: "project",
      default: DEFAULT_STATUS_IDS.refine,
      title: "Refinement status ID",
      description: "Ticket status ID that the refinement loop watches.",
    },
    "automations.status.ready": {
      type: "string",
      scope: "project",
      default: DEFAULT_STATUS_IDS.ready,
      title: "Ready status ID",
      description: "Ticket status ID that the implementation loop picks from.",
    },
    "automations.status.inProgress": {
      type: "string",
      scope: "project",
      default: DEFAULT_STATUS_IDS.inProgress,
      title: "In-progress status ID",
      description: "Ticket status ID counted by the implementation cap and used for active work.",
    },
    "automations.status.blocked": {
      type: "string",
      scope: "project",
      default: DEFAULT_STATUS_IDS.blocked,
      title: "Blocked status ID",
      description: "Ticket status ID used when stuck work ends in a failed session.",
    },
    "automations.status.inReview": {
      type: "string",
      scope: "project",
      default: DEFAULT_STATUS_IDS.inReview,
      title: "In-review status ID",
      description: "Ticket status ID used when implementation completes and review should run.",
    },
  },
} as const satisfies ExtensionSettingsContribution;

export interface AutomationSettings {
  "automations.enabled": boolean;
  "automations.maxInProgress": number;
  "automations.status.refine": string;
  "automations.status.ready": string;
  "automations.status.inProgress": string;
  "automations.status.blocked": string;
  "automations.status.inReview": string;
}
