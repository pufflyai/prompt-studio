import { defineExtension, packageAsset } from "@pstdio/sdk/extensions";
import { gitWorkspace } from "./src/provider";

export default defineExtension({
  defaultLocale: "en",
  translations: { fr: packageAsset("./l10n/fr.json", import.meta.url) },
  workspaceTypes: [gitWorkspace],
});
