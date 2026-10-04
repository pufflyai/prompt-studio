import { defineExtension, defineSkill, l10n, packageAsset } from "@pstdio/sdk/extensions";
import { refinementPolicyCommand } from "./refinement-policy";

export default defineExtension({
  defaultLocale: "en",
  translations: { fr: packageAsset("./l10n/fr.json", import.meta.url) },
  settings: {
    properties: {
      "refinement.generateArtifactPrototype": {
        type: "boolean",
        scope: "project",
        default: true,
        title: l10n("settings.uxPrototype.title", "Generate an artifact prototype for UX features"),
        description: l10n(
          "settings.uxPrototype.description",
          "Require an interactive prototype when refining a new UX feature if Artifacts is available.",
        ),
      },
    },
  },
  commands: [refinementPolicyCommand],
  skills: [
    defineSkill({
      id: "create-pstdio-extension",
      title: "Create a pstdio extension",
      source: packageAsset("./skills/create-pstdio-extension", import.meta.url),
    }),
    defineSkill({
      id: "pstdio",
      title: "Use pstdio",
      source: packageAsset("./skills/pstdio", import.meta.url),
    }),
  ],
});
