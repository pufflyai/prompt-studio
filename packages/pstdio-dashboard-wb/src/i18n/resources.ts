import type { Resource, ResourceKey } from "i18next";

type LocaleModule = {
  default: ResourceKey;
};

const localeModules = import.meta.glob<LocaleModule>("./locales/*/*.json", {
  eager: true,
});

const resources: Resource = {};

for (const [path, module] of Object.entries(localeModules)) {
  const [locale, file] = path.split("/").slice(-2);
  const namespace = file.replace(".json", "");

  if (!resources[locale]) {
    resources[locale] = {};
  }

  resources[locale][namespace] = module.default;
}

export default resources;
