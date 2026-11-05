import { defineExtension, defineView, l10n, packageAsset } from "@pstdio/sdk/extensions";
import { commands } from "./src/commands";

const setup = defineView({
  id: "setup",
  title: l10n("onboarding.title", "Onboarding"),
  icon: "Sparkles",
  body: {
    kind: "webview",
    entry: packageAsset("./src/setup-entry.tsx", import.meta.url),
    capabilities: ["commands.execute", "placement.close"],
  },
});
export default defineExtension({
  defaultLocale: "en",
  translations: {
    es: packageAsset("./l10n/es.json", import.meta.url),
    fr: packageAsset("./l10n/fr.json", import.meta.url),
    ja: packageAsset("./l10n/ja.json", import.meta.url),
    ko: packageAsset("./l10n/ko.json", import.meta.url),
    "zh-Hans": packageAsset("./l10n/zh-Hans.json", import.meta.url),
    "zh-Hant": packageAsset("./l10n/zh-Hant.json", import.meta.url),
  },
  views: [setup],
  commands: Object.values(commands),
  projectSetup: { view: setup.ref, hiddenSetting: "hidden" },
  settings: {
    properties: {
      hidden: {
        type: "boolean",
        scope: "device",
        default: false,
        title: l10n("onboarding.dontShow", "Don’t show onboarding"),
      },
      choices: { type: "object", scope: "device", default: { completed: false, harnesses: null, workAreas: null } },
    },
  },
});
