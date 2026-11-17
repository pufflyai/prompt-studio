import { defineExtension, packageAsset } from "@pstdio/sdk/extensions";
import { terminals } from "./src/resources";
import { openTerminal, openWorkspaceTerminal, terminal, terminalPlacement, terminalResource } from "./src/terminal";

export default defineExtension({
  commandPaletteResources: [terminals],
  resourceKinds: [terminalResource],
  commands: [openTerminal, openWorkspaceTerminal],
  views: [terminal],
  placements: [terminalPlacement],
  translations: { fr: packageAsset("./l10n/fr.json", import.meta.url) },
});
