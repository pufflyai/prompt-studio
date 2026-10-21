import { expect, test } from "bun:test";
import type { ModeRegionSettings } from "../extension-kernel/types/contributions";
import { regionSettingsSchema } from "./placement-metadata";

test("preserves an explicit single-tab policy in region settings", () => {
  const settings = { alwaysShowTabs: true } satisfies ModeRegionSettings;
  expect(regionSettingsSchema.parse(settings)).toEqual(settings);
  expect(regionSettingsSchema.parse({ alwaysShowTabs: false })).toEqual({ alwaysShowTabs: false });
  expect(regionSettingsSchema.parse({})).toEqual({});
  expect(regionSettingsSchema.parse({ showHeader: false })).toEqual({ showHeader: false });
});

test("transfers independent panel capabilities without coupling them", () => {
  const settings = {
    canOpen: false,
    canClose: true,
    acceptsTabs: true,
    resizable: false,
    movable: false,
    floatable: false,
  } satisfies ModeRegionSettings;
  expect(regionSettingsSchema.parse(settings)).toEqual(settings);
});
