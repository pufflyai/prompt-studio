import type { HTMLChakraProps, RecipeVariantProps } from "@chakra-ui/react";
import { createRecipeContext, createSlotRecipeContext } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { panelMenuSlotRecipe, panelMenuToggleRecipe } from "../../theme/recipes/panel-menu";

type PanelMenuVariantProps = RecipeVariantProps<typeof panelMenuSlotRecipe>;

const panelMenuRecipe = createSlotRecipeContext({ recipe: panelMenuSlotRecipe });
const PanelMenuRoot = panelMenuRecipe.withProvider<HTMLDivElement, HTMLChakraProps<"div"> & PanelMenuVariantProps>(
  "div",
  "root",
);
const PanelMenuHeader = panelMenuRecipe.withContext<HTMLDivElement, HTMLChakraProps<"div">>("div", "header");
const PanelMenuIcon = panelMenuRecipe.withContext<HTMLSpanElement, HTMLChakraProps<"span">>("span", "icon");
const PanelMenuTitle = panelMenuRecipe.withContext<HTMLSpanElement, HTMLChakraProps<"span">>("span", "title");
const PanelMenuAction = panelMenuRecipe.withContext<HTMLButtonElement, HTMLChakraProps<"button">>("button", "action");
const PanelMenuContent = panelMenuRecipe.withContext<HTMLDivElement, HTMLChakraProps<"div">>("div", "content");

export interface PanelMenuProps extends PanelMenuVariantProps {
  title: string;
  icon: ReactNode;
  children?: ReactNode;
  reattachLabel?: string;
  sizePx?: number;
  onReattach?: () => void;
}

export const PanelMenu = (props: PanelMenuProps) => {
  const {
    title,
    icon,
    children,
    variant = "docked",
    side = "left",
    reattachLabel = "Reattach",
    sizePx,
    onReattach,
  } = props;

  return (
    <PanelMenuRoot
      variant={variant}
      side={side}
      aria-label={title}
      w={variant === "docked" && sizePx ? `${sizePx}px` : undefined}
    >
      <PanelMenuHeader>
        <PanelMenuIcon>{icon}</PanelMenuIcon>
        <PanelMenuTitle>{title}</PanelMenuTitle>
        {variant === "dropdown" && onReattach ? (
          <PanelMenuAction type="button" onClick={onReattach}>
            {reattachLabel}
          </PanelMenuAction>
        ) : null}
      </PanelMenuHeader>
      <PanelMenuContent>{children}</PanelMenuContent>
    </PanelMenuRoot>
  );
};

type PanelMenuToggleVariantProps = RecipeVariantProps<typeof panelMenuToggleRecipe>;
const panelMenuToggleContext = createRecipeContext({ recipe: panelMenuToggleRecipe });
const StyledPanelMenuToggle = panelMenuToggleContext.withContext<
  HTMLButtonElement,
  HTMLChakraProps<"button"> & PanelMenuToggleVariantProps
>("button");

export interface PanelMenuToggleProps extends Omit<HTMLChakraProps<"button">, "children"> {
  icon: ReactNode;
  open?: boolean;
}

export const PanelMenuToggle = (props: PanelMenuToggleProps) => {
  const { icon, open = false, ...buttonProps } = props;
  return (
    <StyledPanelMenuToggle type="button" open={open} {...buttonProps}>
      {icon}
    </StyledPanelMenuToggle>
  );
};
