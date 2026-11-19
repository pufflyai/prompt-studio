import { l10n } from "@pstdio/sdk/extensions";
export interface Settings {
  templateName: string;
  templateVersion: string;
  testCommand: string;
  timeoutMinutes: number;
  storageBucket: string;
  signerAccount: string;
}

export const settingsSchema = {
  previewBridgePath: {
    type: "string",
    title: l10n("remote-testing.preview-helper.title", "Preview URL helper"),
    scope: "device",
    default: "",
    description: l10n(
      "remote-testing.preview-helper.description",
      "Operator-managed TypeScript helper on this device that returns an expiring HTTPS preview URL.",
    ),
  },
  templateName: {
    type: "string",
    title: "Template",
    scope: "project",
    default: "remote-tests",
    description: "PocketCoder template that runs test commands.",
  },
  templateVersion: {
    type: "string",
    title: "Template version",
    scope: "project",
    default: "",
    description: "Exact published version of the template.",
  },
  testCommand: {
    type: "string",
    title: "Test command",
    scope: "project",
    default: "bun install --frozen-lockfile && bun run test",
    description: "Shell command that runs the test suite in the repository root.",
  },
  timeoutMinutes: {
    type: "number",
    title: "Timeout (minutes)",
    scope: "project",
    default: 60,
  },
  storageBucket: {
    type: "string",
    title: "Storage bucket",
    scope: "project",
    default: "",
    description: "Cloud Storage bucket for run sources and logs.",
  },
  signerAccount: {
    type: "string",
    title: "URL signer",
    scope: "project",
    default: "",
    description: "Service account that signs the short-lived source and log URLs.",
  },
} as const;

export function readSettings(values: Partial<Record<keyof Settings, unknown>>) {
  const text = (key: keyof Settings) => {
    const value = values[key] ?? settingsSchema[key].default;
    return typeof value === "string" ? value.trim() : "";
  };
  const settings: Settings = {
    templateName: text("templateName"),
    templateVersion: text("templateVersion"),
    testCommand: text("testCommand"),
    timeoutMinutes: Number(values.timeoutMinutes ?? settingsSchema.timeoutMinutes.default),
    storageBucket: text("storageBucket"),
    signerAccount: text("signerAccount"),
  };
  const problems = (["templateName", "templateVersion", "testCommand", "storageBucket", "signerAccount"] as const)
    .filter((key) => !settings[key])
    .map((key) => `Set the ${settingsSchema[key].title} setting.`);
  if (!(settings.timeoutMinutes > 0)) problems.push("Set a positive Timeout (minutes) setting.");
  return { settings, problems };
}
