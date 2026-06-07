import type { Resource, ResourceKey } from "i18next";
import enCommon from "./locales/en/common.json";
import enOrganization from "./locales/en/organization.json";
import enProjects from "./locales/en/projects.json";
import enSettings from "./locales/en/settings.json";
import enTickets from "./locales/en/tickets.json";
import esCommon from "./locales/es/common.json";
import esOrganization from "./locales/es/organization.json";
import esProjects from "./locales/es/projects.json";
import esSettings from "./locales/es/settings.json";
import esTickets from "./locales/es/tickets.json";
import frCommon from "./locales/fr/common.json";
import frOrganization from "./locales/fr/organization.json";
import frProjects from "./locales/fr/projects.json";
import frSettings from "./locales/fr/settings.json";
import frTickets from "./locales/fr/tickets.json";
import jaCommon from "./locales/ja/common.json";
import jaOrganization from "./locales/ja/organization.json";
import jaProjects from "./locales/ja/projects.json";
import jaSettings from "./locales/ja/settings.json";
import jaTickets from "./locales/ja/tickets.json";
import koCommon from "./locales/ko/common.json";
import koOrganization from "./locales/ko/organization.json";
import koProjects from "./locales/ko/projects.json";
import koSettings from "./locales/ko/settings.json";
import koTickets from "./locales/ko/tickets.json";
import zhHansCommon from "./locales/zh-Hans/common.json";
import zhHansOrganization from "./locales/zh-Hans/organization.json";
import zhHansProjects from "./locales/zh-Hans/projects.json";
import zhHansSettings from "./locales/zh-Hans/settings.json";
import zhHansTickets from "./locales/zh-Hans/tickets.json";
import zhHantCommon from "./locales/zh-Hant/common.json";
import zhHantOrganization from "./locales/zh-Hant/organization.json";
import zhHantProjects from "./locales/zh-Hant/projects.json";
import zhHantSettings from "./locales/zh-Hant/settings.json";
import zhHantTickets from "./locales/zh-Hant/tickets.json";

const createLocaleResources = (
  common: ResourceKey,
  organization: ResourceKey,
  projects: ResourceKey,
  settings: ResourceKey,
  tickets: ResourceKey,
) => ({
  common,
  organization,
  projects,
  settings,
  tickets,
});

const resources: Resource = {
  en: createLocaleResources(enCommon, enOrganization, enProjects, enSettings, enTickets),
  es: createLocaleResources(esCommon, esOrganization, esProjects, esSettings, esTickets),
  fr: createLocaleResources(frCommon, frOrganization, frProjects, frSettings, frTickets),
  ja: createLocaleResources(jaCommon, jaOrganization, jaProjects, jaSettings, jaTickets),
  ko: createLocaleResources(koCommon, koOrganization, koProjects, koSettings, koTickets),
  "zh-Hans": createLocaleResources(zhHansCommon, zhHansOrganization, zhHansProjects, zhHansSettings, zhHansTickets),
  "zh-Hant": createLocaleResources(zhHantCommon, zhHantOrganization, zhHantProjects, zhHantSettings, zhHantTickets),
};

export default resources;
