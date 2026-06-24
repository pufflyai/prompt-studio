import { defaultConfig } from "@chakra-ui/react";

const shadowStyleKeys = new Set(["boxShadow", "boxShadowColor", "textShadow"]);
const shadowPattern = /shadow/i;

const stripShadowTransitionParts = (value: string) => {
  if (!shadowPattern.test(value)) return value;

  const transitionParts = value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => !shadowPattern.test(part));

  if (transitionParts.length === 0) return undefined;
  return transitionParts.join(", ");
};

const stripShadowStyles = <T>(value: T) => {
  if (Array.isArray(value)) {
    return value.map(stripShadowStyles).filter((entry) => entry !== undefined) as T;
  }

  if (typeof value === "string") {
    return stripShadowTransitionParts(value) as T;
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) => {
      if (shadowStyleKeys.has(key) || shadowPattern.test(key)) return [];

      const nextEntry = stripShadowStyles(entry);
      if (nextEntry === undefined) return [];
      return [[key, nextEntry]];
    }),
  ) as T;
};

const stripShadowTokens = <T extends Record<string, unknown> | undefined>(tokens: T) => {
  const { shadows: _shadows, ...tokensWithoutShadows } = tokens ?? {};
  return tokensWithoutShadows;
};

// Chakra's default recipes include elevation; keep the recipes but remove shadow styling.
export const shadowlessDefaultConfig = {
  ...defaultConfig,
  theme: {
    ...defaultConfig.theme,
    tokens: stripShadowTokens(defaultConfig.theme?.tokens),
    semanticTokens: stripShadowTokens(defaultConfig.theme?.semanticTokens),
    recipes: stripShadowStyles(defaultConfig.theme?.recipes),
    slotRecipes: stripShadowStyles(defaultConfig.theme?.slotRecipes),
    layerStyles: stripShadowStyles(defaultConfig.theme?.layerStyles),
    animationStyles: stripShadowStyles(defaultConfig.theme?.animationStyles),
  },
};
