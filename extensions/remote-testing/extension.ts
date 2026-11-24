import {
  defineExtension,
  defineKeybinding,
  defineSchedule,
  defineSkill,
  l10n,
  packageAsset,
} from "@pstdio/sdk/extensions";
import { createBranchTemplate, openPromptStudio, runPromptStudio } from "./src/branch-commands";
import { commands } from "./src/commands";
import { connection, templatePublisher } from "./src/connection";
import { recoverEnvironmentCleanup } from "./src/environment-cleanup";
import { runRecoveryIndex } from "./src/run-recovery";
import { settingsSchema } from "./src/settings";
import { environmentsView, navigation, remoteTestsPage, runsView } from "./src/workbench";

export default defineExtension({
  translations: { fr: packageAsset("./l10n/fr.json", import.meta.url) },
  settings: { properties: settingsSchema },
  storageIndexes: [runRecoveryIndex],
  connections: [connection, templatePublisher],
  commands: [...commands, createBranchTemplate, runPromptStudio, openPromptStudio],
  schedules: [
    defineSchedule({
      id: "resume-environment-cleanup",
      title: recoverEnvironmentCleanup.title,
      schedule: "* * * * *",
      command: recoverEnvironmentCleanup.ref,
    }),
  ],
  views: [runsView, environmentsView],
  pages: [remoteTestsPage],
  navigationItems: [navigation],
  keybindings: [
    defineKeybinding({ id: "go-remote-tests", layer: "go", key: "R", sticky: true, action: navigation.action }),
  ],
  skills: [
    defineSkill({
      id: "run-tests-remotely",
      title: l10n("remote-testing.run-tests-remotely", "Run tests remotely"),
      description: l10n(
        "remote-testing.run-the-repository-s-test-suite-on-a-remote-pocketcoder-environment-and-manage-those-environments",
        "Run the repository's test suite on a remote PocketCoder environment and manage those environments.",
      ),
      source: packageAsset("./skills/run-tests-remotely", import.meta.url),
    }),
  ],
});
