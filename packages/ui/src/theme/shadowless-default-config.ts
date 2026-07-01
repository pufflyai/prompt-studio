import { defaultConfig, type SystemConfig } from "@chakra-ui/react";

// this is an escape hatch:
// remove unwanted chakra default programmatically
// whenever possible we should update the recipes

const shadowStyleKeys = new Set(["boxShadow", "boxShadowColor", "textShadow"]);
const shadowPattern = /shadow/i;
type ThemeConfig = NonNullable<SystemConfig["theme"]>;
type ShadowStyleTransformer = (value: unknown) => unknown;

const stripShadowTransitionParts = (value: string) => {
  if (!shadowPattern.test(value)) return value;

  const transitionParts = value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => !shadowPattern.test(part));

  if (transitionParts.length === 0) return undefined;
  return transitionParts.join(", ");
};

const stripShadowStyles: ShadowStyleTransformer = (value) => {
  if (Array.isArray(value)) {
    return value.map(stripShadowStyles).filter((entry) => entry !== undefined);
  }

  if (typeof value === "string") {
    return stripShadowTransitionParts(value);
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
  );
};

const stripShadowTokens = <T extends Record<string, unknown> | undefined>(tokens: T) => {
  const { shadows: _shadows, ...tokensWithoutShadows } = tokens ?? {};
  return tokensWithoutShadows;
};

const REMOVED_RECIPE_VARIANTS = {
  badge: ["surface"],
  button: ["secondary", "surface"],
} as const;

const stripRemovedRecipeVariants = (recipes: ThemeConfig["recipes"]) => {
  const nextRecipes = { ...(recipes ?? {}) } as Record<string, unknown>;

  for (const [recipeName, removedVariants] of Object.entries(REMOVED_RECIPE_VARIANTS)) {
    const recipe = nextRecipes[recipeName];
    if (!recipe || typeof recipe !== "object") continue;

    const typedRecipe = recipe as { variants?: { variant?: Record<string, unknown> } };
    const variants = typedRecipe.variants;
    const variant = variants?.variant;
    if (!variant) continue;

    const removedVariantSet = new Set<string>(removedVariants);
    const variantsWithoutRemovedEntries = Object.fromEntries(
      Object.entries(variant).filter(([variantName]) => !removedVariantSet.has(variantName)),
    );
    nextRecipes[recipeName] = {
      ...typedRecipe,
      variants: {
        ...variants,
        variant: variantsWithoutRemovedEntries,
      },
    };
  }

  return nextRecipes as ThemeConfig["recipes"];
};

// Chakra's default recipes include elevation; keep the recipes but remove shadow styling.
export const shadowlessDefaultConfig: SystemConfig = {
  ...defaultConfig,
  theme: {
    ...defaultConfig.theme,
    tokens: stripShadowTokens(defaultConfig.theme?.tokens) as ThemeConfig["tokens"],
    semanticTokens: stripShadowTokens(defaultConfig.theme?.semanticTokens) as ThemeConfig["semanticTokens"],
    recipes: stripRemovedRecipeVariants(stripShadowStyles(defaultConfig.theme?.recipes) as ThemeConfig["recipes"]),
    slotRecipes: stripShadowStyles(defaultConfig.theme?.slotRecipes) as ThemeConfig["slotRecipes"],
    layerStyles: stripShadowStyles(defaultConfig.theme?.layerStyles) as ThemeConfig["layerStyles"],
    animationStyles: stripShadowStyles(defaultConfig.theme?.animationStyles) as ThemeConfig["animationStyles"],
  },
};
