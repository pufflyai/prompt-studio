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
    title: l10n("remote-testing.template", "Template"),
    scope: "project",
    default: "remote-tests",
    description: l10n(
      "remote-testing.pocketcoder-template-that-runs-test-commands",
      "PocketCoder template that runs test commands.",
    ),
  },
  templateVersion: {
    type: "string",
    title: l10n("remote-testing.template-version", "Template version"),
    scope: "project",
    default: "",
    description: l10n(
      "remote-testing.exact-published-version-of-the-template",
      "Exact published version of the template.",
    ),
  },
  testCommand: {
    type: "string",
    title: l10n("remote-testing.test-command", "Test command"),
    scope: "project",
    default: "bun install --frozen-lockfile && bun run test",
    description: l10n(
      "remote-testing.shell-command-that-runs-the-test-suite-in-the-repository-root",
      "Shell command that runs the test suite in the repository root.",
    ),
  },
  timeoutMinutes: {
    type: "number",
    title: l10n("remote-testing.timeout-minutes", "Timeout (minutes)"),
    scope: "project",
    default: 60,
  },
  storageBucket: {
    type: "string",
    title: l10n("remote-testing.storage-bucket", "Storage bucket"),
    scope: "project",
    default: "",
    description: l10n(
      "remote-testing.cloud-storage-bucket-for-run-sources-and-logs",
      "Cloud Storage bucket for run sources and logs.",
    ),
  },
  signerAccount: {
    type: "string",
    title: l10n("remote-testing.url-signer", "URL signer"),
    scope: "project",
    default: "",
    description: l10n(
      "remote-testing.service-account-that-signs-the-short-lived-source-and-log-urls",
      "Service account that signs the short-lived source and log URLs.",
    ),
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
    .map((key) => `Set the ${settingsSchema[key].title.default} setting.`);
  if (!(settings.timeoutMinutes > 0)) problems.push("Set a positive Timeout (minutes) setting.");
  return { settings, problems };
}
