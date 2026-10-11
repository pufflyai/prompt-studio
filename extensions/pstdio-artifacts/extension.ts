import {
  defineArtifactMount,
  defineExtension,
  defineKeybinding,
  defineNavigationItem,
  defineSkill,
  l10n,
  packageAsset,
  workbenchModes,
} from "@pstdio/sdk/extensions";
import { commands } from "./src/commands";
import { libraryTarget } from "./src/contracts";
import { artifact, detail, library, openView, view } from "./src/pages";
import { artifactResources } from "./src/resources";

export default defineExtension({
  defaultLocale: "en",
  translations: { fr: packageAsset("./l10n/fr.json", import.meta.url) },
  commands: Object.values(commands),
  artifactMounts: [defineArtifactMount({ id: "sites", path: "sites", label: l10n("mounts.sites", "Published HTML") })],
  resourceKinds: [artifact],
  commandPaletteResources: [artifactResources],
  views: [view, openView],
  pages: [library, detail],
  keybindings: [defineKeybinding({ id: "open-artifacts", key: "Alt+Shift+A", action: libraryTarget })],
  navigationItems: [
    defineNavigationItem({
      id: "artifacts",
      label: l10n("navigation.artifacts", "Artifacts"),
      icon: "file-code",
      owner: workbenchModes.project,
      action: libraryTarget,
    }),
  ],
  skills: [
    defineSkill({
      id: "publish-artifact",
      title: l10n("skills.publish", "Publish an artifact"),
      source: packageAsset("./skills/publish-artifact", import.meta.url),
    }),
  ],
});
