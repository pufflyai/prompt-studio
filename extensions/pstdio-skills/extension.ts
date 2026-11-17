import { defineExtension, defineSkill, l10n, packageAsset } from "@pstdio/sdk/extensions";

export default defineExtension({
  translations: { fr: packageAsset("./l10n/fr.json", import.meta.url) },
  skills: [
    defineSkill({
      id: "use-resource-activity",
      title: l10n("skills.resourceActivity", "Use resource Activity"),
      source: packageAsset("./skills/use-resource-activity", import.meta.url),
    }),
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
