import { defineExtension, defineHarness, l10n } from "@pstdio/sdk/extensions";
import { createCodexHarness } from "./src/harness";
import { provisionSkills } from "./src/hooks";
import { quotasCommand } from "./src/quotas";
export default defineExtension({
  settings: {
    properties: {
      restartAfterQuotaReset: {
        type: "boolean",
        scope: "device",
        default: false,
        title: l10n("quota.restart.title", "Restart after quota reset"),
        description: l10n(
          "quota.restart.description",
          "Resume conversations stopped by quota limits 15 seconds after the limits reset. Manual stops stay stopped.",
        ),
      },
    },
  },
  commands: [quotasCommand],
  harnesses: [defineHarness(createCodexHarness())],
  hooks: [provisionSkills],
});
