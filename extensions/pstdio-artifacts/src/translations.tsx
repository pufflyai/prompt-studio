import type { ExtensionViewRenderContext } from "@pstdio/sdk/extensions";
import { createContext, useContext } from "react";

export const ArtifactTranslations = createContext<Pick<ExtensionViewRenderContext, "locale" | "t"> | null>(null);

export const useArtifactTranslations = () => {
  const translations = useContext(ArtifactTranslations);
  if (!translations) throw new Error("Artifact translations are not available.");
  return translations;
};
