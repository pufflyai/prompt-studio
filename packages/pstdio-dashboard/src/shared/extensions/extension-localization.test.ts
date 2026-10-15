import { expect, test } from "bun:test";
import i18n from "@/i18n";
import { createRuntimeCollections } from "@/lib/sync/collections";
import {
  getExtensionTranslationContext,
  registerExtensionTranslationBundles,
  resolveLocalizableString,
} from "./extension-localization";

test("runtime translation bundles keep the same extension's local revisions separate", async () => {
  await i18n.changeLanguage("en");
  const first = createRuntimeCollections();
  const second = createRuntimeCollections();
  const appearance = (label: string) => ({
    themes: [],
    fileIconThemes: [],
    diagnostics: [],
    translations: [{ extensionId: "same", defaultLocale: "en", bundles: { en: { label } } }],
  });
  const a = registerExtensionTranslationBundles(appearance("First"), first);
  const b = registerExtensionTranslationBundles(appearance("Second"), second);
  try {
    expect(resolveLocalizableString({ $l10n: "label" }, "same", undefined, first)).toBe("First");
    expect(resolveLocalizableString({ $l10n: "label" }, "same", undefined, second)).toBe("Second");
    a.dispose();
    expect(getExtensionTranslationContext("same", "en", second).bundle).toEqual({ label: "Second" });
  } finally {
    a.dispose();
    b.dispose();
    await first.dispose();
    await second.dispose();
  }
});
