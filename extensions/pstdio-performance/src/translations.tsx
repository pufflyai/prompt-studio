import type { ExtensionViewRenderContext } from "@pstdio/sdk/extensions";
import { createContext, useContext } from "react";

export const PerformanceTranslations = createContext<Pick<ExtensionViewRenderContext, "locale" | "t">>({
  locale: "en",
  t: (_key, defaultValue, args) =>
    Object.entries(args ?? {}).reduce(
      (text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)),
      defaultValue ?? "",
    ),
});

export const useTranslations = () => {
  const { locale, t } = useContext(PerformanceTranslations);
  // Bundles keep the plural keys of the dashboard strings they came from, such as `views_one`.
  const plural = (key: string, count: number, one: string, other: string) => {
    const category = new Intl.PluralRules(locale).select(count);
    const fallback = count === 1 ? one : other;
    const value = t(`${key}_${category}`, "", { count });
    return value || t(`${key}_other`, fallback, { count });
  };
  return { locale, t, plural };
};
