import { expect, test } from "bun:test";
import { createWebviewHostProps } from "./host-props";

test("all webview hosts send the same typed defaults and preserve their context", () => {
  const props = createWebviewHostProps();
  expect(props).toEqual({
    projectId: undefined,
    themePreference: "system",
    locale: "en",
    resource: undefined,
    pageLocation: undefined,
    pageParams: {},
    translations: { locale: "en", defaultLocale: "en", bundle: {}, defaultBundle: {} },
  });
  expect(
    createWebviewHostProps({
      projectId: "project",
      locale: "fr",
      themePreference: "paper",
      pageParams: { tab: "notes" },
      custom: 7,
    }),
  ).toMatchObject({
    projectId: "project",
    locale: "fr",
    themePreference: "paper",
    pageParams: { tab: "notes" },
    translations: { locale: "fr", defaultLocale: "fr" },
    custom: 7,
  });
});
