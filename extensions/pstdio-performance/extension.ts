import {
  defineExtension,
  defineStatusBarItem,
  defineView,
  l10n,
  packageAsset,
  workbenchSlots,
} from "@pstdio/sdk/extensions";

const meter = defineView({
  id: "meter",
  title: l10n("views.meter", "Performance"),
  icon: "gauge",
  body: {
    kind: "webview",
    entry: packageAsset("./src/meter-view.tsx", import.meta.url),
    capabilities: ["performance.read"],
  },
});

const details = defineView({
  id: "details",
  title: l10n("views.details", "Performance details"),
  icon: "gauge",
  body: {
    kind: "webview",
    entry: packageAsset("./src/details-view.tsx", import.meta.url),
    capabilities: ["performance.read", "performance.control", "clipboard.write"],
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
  views: [meter, details],
  statusBarItems: [
    defineStatusBarItem({
      id: "performance",
      view: meter.ref,
      popover: details.ref,
      slot: workbenchSlots.statusBarTrailing,
    }),
  ],
});
