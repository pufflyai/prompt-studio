import { defineExtension, defineSkill, packageAsset } from "@pstdio/sdk/extensions";
import { createBranchTemplate, openPromptStudio, runPromptStudio } from "./src/branch-commands";
import { commands } from "./src/commands";
import { connection, templatePublisher } from "./src/connection";
import { settingsSchema } from "./src/settings";
import { environmentsView, navigation, remoteTestsPage, runsView } from "./src/workbench";

export default defineExtension({
  translations: { fr: packageAsset("./l10n/fr.json", import.meta.url) },
  settings: { properties: settingsSchema },
  connections: [connection, templatePublisher],
  commands: [...commands, createBranchTemplate, runPromptStudio, openPromptStudio],
  views: [runsView, environmentsView],
  pages: [remoteTestsPage],
  navigationItems: [navigation],
  skills: [
    defineSkill({
      id: "run-tests-remotely",
      title: "Run tests remotely",
      description: "Run the repository's test suite on a remote PocketCoder environment and manage those environments.",
      source: packageAsset("./skills/run-tests-remotely", import.meta.url),
    }),
  ],
});
