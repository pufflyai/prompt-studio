import type { ExtensionViewRenderContext } from "@pstdio/sdk/extensions";
import type { ReactNode } from "react";
import french from "../../l10n/fr.json";
import { ArtifactTranslations } from "../translations";

export const ArtifactTranslationStory = (props: { children: ReactNode; locale?: string }) => {
  const { children, locale = "en" } = props;
  const bundle: Record<string, string> = locale === "fr" ? french : {};
  const t: ExtensionViewRenderContext["t"] = (key, fallback = key, args = {}) =>
    Object.entries(args).reduce(
      (value, [name, replacement]) => value.replaceAll(`{{${name}}}`, String(replacement)),
      bundle[key] ?? fallback,
    );
  return <ArtifactTranslations value={{ locale, t }}>{children}</ArtifactTranslations>;
};
