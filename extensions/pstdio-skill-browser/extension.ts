import { defineExtension, packageAsset } from "@pstdio/sdk/extensions";
import { browser } from "./src/browser";

export default defineExtension({
  ...browser,
  defaultLocale: "en",
  translations: { fr: packageAsset("./l10n/fr.json", import.meta.url) },
});
