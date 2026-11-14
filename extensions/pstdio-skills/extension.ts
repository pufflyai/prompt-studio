import { defineExtension, defineSkill, packageAsset } from "@pstdio/sdk/extensions";
import { browser } from "./src/browser";

export default defineExtension({
  ...browser,
  defaultLocale: "en",
  translations: { fr: packageAsset("./l10n/fr.json", import.meta.url) },
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
