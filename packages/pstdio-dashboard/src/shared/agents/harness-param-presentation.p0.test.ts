import { expect, test } from "bun:test";
import type { HarnessParamsInfo } from "pstdio-api-contracts";
import i18n from "@/i18n";
import { createRuntimeCollections } from "@/lib/sync/collections";
import { registerExtensionTranslationBundles } from "@/shared/extensions/extension-localization";
import { harnessParamPresentation } from "./harness-param-presentation";

test("harness forms translate agent/default schemas and model overrides within the selected project", async () => {
  const owner = createRuntimeCollections();
  const appearance = (label: string) => ({
    themes: [],
    fileIconThemes: [],
    diagnostics: [],
    translations: [{ extensionId: "harness", defaultLocale: "en", bundles: { fr: { plan: label, fast: "Rapide" } } }],
  });
  const a = registerExtensionTranslationBundles(appearance("Planifier"), owner, "a");
  const b = registerExtensionTranslationBundles(appearance("Préparer"), owner, "b");
  const base: HarnessParamsInfo = {
    mode: {
      type: "select",
      defaultValue: "fast",
      options: [{ value: "fast", label: "Fast", localizedLabel: { $l10n: "fast" } }],
    },
    hidden: { type: "boolean", defaultValue: true },
  };
  const model = {
    paramOverrides: {
      mode: {
        type: "select" as const,
        defaultValue: "plan",
        options: [{ value: "plan", label: "Plan", localizedLabel: { $l10n: "plan" } }],
      },
      hidden: null,
    },
  };
  try {
    await i18n.changeLanguage("fr");
    expect(harnessParamPresentation(base, undefined, "harness", "a", owner)?.mode).toMatchObject({
      options: [{ label: "Rapide", value: "fast" }],
    });
    const first = harnessParamPresentation(base, model, "harness", "a", owner, i18n.getFixedT("fr"));
    expect(first?.mode).toMatchObject({ defaultValue: "plan", options: [{ label: "Planifier", value: "plan" }] });
    expect(first?.hidden).toBeUndefined();
    expect(harnessParamPresentation(base, model, "harness", "b", owner)?.mode).toMatchObject({
      options: [{ label: "Préparer" }],
    });
    await i18n.changeLanguage("en");
    expect(harnessParamPresentation(base, model, "harness", "a", owner)?.mode).toMatchObject({
      options: [{ label: "Plan" }],
    });
    expect(base.mode).toMatchObject({ options: [{ label: "Fast", localizedLabel: { $l10n: "fast" } }] });
  } finally {
    a.dispose();
    b.dispose();
    await owner.dispose();
    await i18n.changeLanguage("en");
  }
});
