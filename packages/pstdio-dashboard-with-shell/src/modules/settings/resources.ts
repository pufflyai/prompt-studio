import type { ResourceRef } from "pstdio-shell/core";
import { SETTINGS_ICON, SETTINGS_RESOURCE_KIND } from "./constants";

const SETTINGS_PATTERN = /^(?:pstdio:\/\/settings|#settings)$/;

export const createSettingsResource = (): ResourceRef => ({
  kind: SETTINGS_RESOURCE_KIND,
  uri: "pstdio://settings",
  label: "Settings",
  icon: SETTINGS_ICON,
});

export const parseSettingsLocation = (location: string) =>
  SETTINGS_PATTERN.test(location) ? createSettingsResource() : null;

export const createSettingsHref = () => "#settings";

export const isSettingsResource = (resource: ResourceRef) => resource.kind === SETTINGS_RESOURCE_KIND;
