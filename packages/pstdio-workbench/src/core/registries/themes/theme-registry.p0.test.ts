import { describe, expect, test } from "bun:test";
import { createThemeRegistry } from "./theme-registry";

const themeOption = (id: string) => ({ id, mode: "dark" as const });

describe("createThemeRegistry", () => {
  test("starts with no themes", () => {
    const registry = createThemeRegistry();

    expect(registry.listThemes()).toEqual([]);
  });

  test("register publishes themes; disposing the registration removes them", () => {
    const registry = createThemeRegistry();
    const midnight = themeOption("midnight");

    const registration = registry.register([midnight]);
    expect(registry.listThemes()).toEqual([midnight]);

    registration.dispose();
    expect(registry.listThemes()).toEqual([]);
  });

  test("keeps independent registrations isolated", () => {
    const registry = createThemeRegistry();
    const sunrise = themeOption("sunrise");
    const dusk = themeOption("dusk");

    const first = registry.register([sunrise]);
    registry.register([dusk]);
    expect(registry.listThemes()).toEqual([sunrise, dusk]);

    first.dispose();
    expect(registry.listThemes()).toEqual([dusk]);
  });
});
