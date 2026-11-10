import { defineCommand, l10n } from "@pstdio/sdk/extensions";

export const quotasCommand = defineCommand({
  id: "quotas",
  title: l10n("quotas.title", "Inspect account quotas"),
  description: l10n("quotas.description", "Report whether Pi exposes account quota information."),
  cli: true,
  run: () => ({
    status: "unsupported" as const,
    checkedAt: new Date().toISOString(),
    limits: [],
    message: "Pi does not expose account quotas. Check the connected provider's usage dashboard.",
  }),
});
