import { expect, test } from "bun:test";
import i18n from "@/i18n";
import { createRuntimeCollections } from "@/lib/sync/collections";
import {
  getExtensionTranslationContext,
  registerExtensionTranslationBundles,
  resolveLocalizableString,
} from "./extension-localization";

test("disposing the runtime owner removes its translation resources", async () => {
  const owner = createRuntimeCollections();
  const namespace = `ext:${owner.id}:same`;
  const registration = registerExtensionTranslationBundles(
    {
      themes: [],
      fileIconThemes: [],
      diagnostics: [],
      translations: [{ extensionId: "same", defaultLocale: "en", bundles: { en: { label: "Owned" } } }],
    },
    owner,
  );
  try {
    expect(i18n.hasResourceBundle("en", namespace)).toBe(true);
    await owner.dispose();
    expect(i18n.hasResourceBundle("en", namespace)).toBe(false);
  } finally {
    registration.dispose();
    await owner.dispose();
  }
});

test("replacing project translations survives disposal of the previous appearance", async () => {
  const owner = createRuntimeCollections();
  const appearance = (label: string) => ({
    themes: [],
    fileIconThemes: [],
    diagnostics: [],
    translations: [{ extensionId: "same", defaultLocale: "en", bundles: { en: { label } } }],
  });
  const previous = registerExtensionTranslationBundles(appearance("Previous"), owner);
  const next = registerExtensionTranslationBundles(appearance("Next"), owner);
  try {
    previous.dispose();
    expect(getExtensionTranslationContext("same", "en", owner).bundle).toEqual({ label: "Next" });
    expect(resolveLocalizableString({ $l10n: "label" }, "same", undefined, owner)).toBe("Next");
  } finally {
    next.dispose();
    await owner.dispose();
  }
});

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
