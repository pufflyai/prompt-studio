import { afterEach, expect, test } from "bun:test";
import type { ListExtensionAppearanceResponse } from "@pstdio/sdk/api";
import i18n from "@/i18n";
import { localizeExtensionValue, registerExtensionTranslationBundles } from "./extension-localization";

let dispose: (() => void) | undefined;
afterEach(async () => {
  dispose?.();
  await i18n.changeLanguage("en");
});

test("resolves automatic paths and explicit shared keys with locale fallbacks", async () => {
  const appearance = {
    themes: [],
    fileIconThemes: [],
    diagnostics: [],
    translations: [
      {
        extensionId: "test.locale",
        defaultLocale: "en",
        bundles: {
          en: {
            "contributions/views/editor.theme/title": "Editor",
            "contributions/views/editor/body/emptyTitle": "Empty",
            shared: "Shared",
          },
          fr: { "contributions/views/editor.theme/title": "Éditeur", shared: "Partagé" },
        },
      },
    ],
  } satisfies ListExtensionAppearanceResponse;
  dispose = registerExtensionTranslationBundles(appearance).dispose;
  await i18n.changeLanguage("fr");
  expect(
    localizeExtensionValue(
      {
        title: { $l10n: "contributions/views/editor.theme/title", default: "Editor" },
        empty: { $l10n: "contributions/views/editor/body/emptyTitle", default: "Empty" },
        shared: { $l10n: "shared", default: "Shared" },
      },
      "test.locale",
    ),
  ).toEqual({ title: "Éditeur", empty: "Empty", shared: "Partagé" });
  await i18n.changeLanguage("en");
  expect(
    localizeExtensionValue({ $l10n: "contributions/views/editor.theme/title", default: "Editor" }, "test.locale"),
  ).toBe("Editor");
});
