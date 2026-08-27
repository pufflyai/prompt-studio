import type { Resource, ResourceKey } from "i18next";
import enCommon from "./locales/en/common.json";
import enProjects from "./locales/en/projects.json";
import enSettings from "./locales/en/settings.json";
import esCommon from "./locales/es/common.json";
import esProjects from "./locales/es/projects.json";
import esSettings from "./locales/es/settings.json";
import frCommon from "./locales/fr/common.json";
import frProjects from "./locales/fr/projects.json";
import frSettings from "./locales/fr/settings.json";
import jaCommon from "./locales/ja/common.json";
import jaProjects from "./locales/ja/projects.json";
import jaSettings from "./locales/ja/settings.json";
import koCommon from "./locales/ko/common.json";
import koProjects from "./locales/ko/projects.json";
import koSettings from "./locales/ko/settings.json";
import zhHansCommon from "./locales/zh-Hans/common.json";
import zhHansProjects from "./locales/zh-Hans/projects.json";
import zhHansSettings from "./locales/zh-Hans/settings.json";
import zhHantCommon from "./locales/zh-Hant/common.json";
import zhHantProjects from "./locales/zh-Hant/projects.json";
import zhHantSettings from "./locales/zh-Hant/settings.json";

const createLocaleResources = (common: ResourceKey, projects: ResourceKey, settings: ResourceKey) => ({
  common,
  projects,
  settings,
});

const resources: Resource = {
  en: createLocaleResources(enCommon, enProjects, enSettings),
  es: createLocaleResources(esCommon, esProjects, esSettings),
  fr: createLocaleResources(frCommon, frProjects, frSettings),
  ja: createLocaleResources(jaCommon, jaProjects, jaSettings),
  ko: createLocaleResources(koCommon, koProjects, koSettings),
  "zh-Hans": createLocaleResources(zhHansCommon, zhHansProjects, zhHansSettings),
  "zh-Hant": createLocaleResources(zhHantCommon, zhHantProjects, zhHantSettings),
};

export default resources;
