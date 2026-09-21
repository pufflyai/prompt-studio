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
  const titleKey = "contributions/views/editor.theme/title";
  const emptyKey = "contributions/views/editor/body/emptyTitle";
  const bundles = {
    en: { [titleKey]: "Editor", [emptyKey]: "Empty", shared: "Shared" },
    fr: { [titleKey]: "Éditeur", shared: "Partagé" },
  };
  const appearance = {
    themes: [],
    fileIconThemes: [],
    diagnostics: [],
    translations: [
      {
        extensionId: "test.locale",
        defaultLocale: "en",
        bundles,
      },
    ],
  } satisfies ListExtensionAppearanceResponse;
  dispose = registerExtensionTranslationBundles(appearance).dispose;
  await i18n.changeLanguage("fr");
  expect(
    localizeExtensionValue(
      {
        title: { $l10n: titleKey, default: bundles.en[titleKey] },
        empty: { $l10n: emptyKey, default: bundles.en[emptyKey] },
        shared: { $l10n: "shared", default: bundles.en.shared },
      },
      "test.locale",
    ),
  ).toEqual({ title: bundles.fr[titleKey], empty: bundles.en[emptyKey], shared: bundles.fr.shared });
  await i18n.changeLanguage("en");
  expect(localizeExtensionValue({ $l10n: titleKey, default: bundles.en[titleKey] }, "test.locale")).toBe(
    bundles.en[titleKey],
  );
});
