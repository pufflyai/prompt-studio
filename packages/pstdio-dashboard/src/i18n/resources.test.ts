import { describe, expect, test } from "bun:test";
import { SUPPORTED_I18N_CODES } from "./languages";
import resources from "./resources";

describe("dashboard i18n resources", () => {
  test("loads each locale namespace from its own resource file", () => {
    for (const locale of SUPPORTED_I18N_CODES) {
      const localeResources = resources[locale];

      expect(localeResources?.common).toBeDefined();
      expect(localeResources?.projects).toBeDefined();
      expect(localeResources?.settings).toBeDefined();
      expect(localeResources?.tickets).toBeDefined();
      expect(localeResources?.organization).toBeDefined();
      expect(localeResources?.projects).not.toBe(localeResources?.common);
      expect(localeResources?.settings).not.toBe(localeResources?.common);
    }
  });
});
