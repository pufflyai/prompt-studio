import { createSlotRecipeContext, type HTMLChakraProps, type RecipeVariantProps } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { windowTitleBarRecipe as recipe } from "@/theme/recipes/window-title-bar";

const { withProvider, withContext } = createSlotRecipeContext({ recipe });
interface RootProps extends HTMLChakraProps<"div">, RecipeVariantProps<typeof recipe> {}
const Root = withProvider<HTMLDivElement, RootProps>("div", "root");
const Content = withContext<HTMLDivElement, HTMLChakraProps<"div">>("div", "content");
const Actions = withContext<HTMLDivElement, HTMLChakraProps<"div">>("div", "actions");

export interface WindowTitleBarProps {
  platform: string;
  children?: ReactNode;
  /** Controls aligned to the trailing edge, before the native window controls. */
  actions?: ReactNode;
}

export const WindowTitleBar = (props: WindowTitleBarProps) => {
  const { platform, children, actions } = props;
  return (
    <Root controls={platform === "darwin" ? "mac" : "overlay"} data-window-title-bar="">
      <Content>
        {children}
        {actions && <Actions>{actions}</Actions>}
      </Content>
    </Root>
  );
};
