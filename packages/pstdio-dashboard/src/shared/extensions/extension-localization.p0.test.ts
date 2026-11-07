import { expect, test } from "bun:test";
import i18n from "@/i18n";
import { createRuntimeCollections } from "@/lib/sync/collections";
import {
  getExtensionTranslationContext,
  localizeExtensionAppearance,
  localizeExtensionValue,
  registerExtensionTranslationBundles,
  resolveLocalizableString,
} from "./extension-localization";

test("localizing a label retains unchanged payloads and leaves the source intact", () => {
  const tokens = { colors: { background: "#123456" }, rules: [{ token: "comment", color: "#abcdef" }] };
  const source = { title: { $l10n: "missing", default: "Title" }, tokens, entries: [tokens] };
  const localized = localizeExtensionValue(source) as {
    title: string;
    tokens: typeof tokens;
    entries: (typeof tokens)[];
  };
  expect(localized.title).toBe("Title");
  expect(localized.tokens).toBe(tokens);
  expect(localized.entries).toBe(source.entries);
  expect(source.title).toEqual({ $l10n: "missing", default: "Title" });
  expect(localizeExtensionValue(tokens)).toBe(tokens);
});

test("bulk labels retain their namespace, fallback and current locale", async () => {
  const owner = createRuntimeCollections();
  const registration = registerExtensionTranslationBundles(
    {
      themes: [],
      fileIconThemes: [],
      diagnostics: [],
      translations: [
        { extensionId: "first", defaultLocale: "en", bundles: { en: { title: "First" }, fr: { title: "Premier" } } },
        { extensionId: "second", defaultLocale: "en", bundles: { en: { title: "Second" } } },
      ],
    },
    owner,
  );
  const source = [
    { extensionId: "first", title: { $l10n: "title" }, repeated: { $l10n: "title" } },
    { extensionId: "second", title: { $l10n: "title" } },
    { title: { $l10n: "absent", default: "A" }, repeated: { $l10n: "absent", default: "B" } },
  ];
  try {
    await i18n.changeLanguage("en");
    expect(localizeExtensionValue(source, undefined, owner)).toEqual([
      { extensionId: "first", title: "First", repeated: "First" },
      { extensionId: "second", title: "Second" },
      { title: "A", repeated: "B" },
    ]);
    await i18n.changeLanguage("fr");
    expect(localizeExtensionValue(source, undefined, owner)).toEqual([
      { extensionId: "first", title: "Premier", repeated: "Premier" },
      { extensionId: "second", title: "Second" },
      { title: "A", repeated: "B" },
    ]);
  } finally {
    registration.dispose();
    await owner.dispose();
    await i18n.changeLanguage("en");
  }
});

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

test("appearance localization preserves literal theme payloads and translation keys", () => {
  const tokens = { $l10n: "literal-token", "colors.bg": "#123456" };
  const monacoTheme = {
    base: "vs-dark" as const,
    inherit: true as const,
    rules: [{ $l10n: "literal-rule" }],
    colors: {},
  };
  const definitions = { $l10n: "literal-icon", file: { iconPath: "data:image/svg+xml;base64,PHN2Zy8+" } };
  const translations = [{ extensionId: "palette", defaultLocale: "en", bundles: { en: { $l10n: "A literal key" } } }];
  const source = { kind: "package-asset" as const, path: "./theme.json", baseUrl: "file:///palette/extension.ts" };
  const localized = localizeExtensionAppearance({
    themes: [
      {
        id: "theme",
        extensionId: "palette",
        title: { $l10n: "title", default: "Palette" },
        description: { $l10n: "description", default: "Description" },
        format: "vscode-color-theme",
        mode: "dark",
        source,
        tokens,
        monacoTheme,
      },
    ],
    fileIconThemes: [
      {
        id: "icons",
        extensionId: "palette",
        title: { $l10n: "icons", default: "Icons" },
        format: "vscode-file-icon-theme",
        source,
        definitions,
        fileExtensions: {},
        fileNames: {},
        defaults: {},
        fonts: [],
      },
    ],
    translations,
    diagnostics: [],
  });
  expect(localized.themes[0]?.title).toBe("Palette");
  expect(localized.themes[0]?.description).toBe("Description");
  expect(localized.themes[0]?.tokens).toBe(tokens);
  expect(localized.themes[0]?.monacoTheme).toBe(monacoTheme);
  expect(localized.fileIconThemes[0]?.title).toBe("Icons");
  expect(localized.fileIconThemes[0]?.definitions).toBe(definitions);
  expect(localized.translations).toBe(translations);
});
