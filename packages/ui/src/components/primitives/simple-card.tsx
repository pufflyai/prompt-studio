import { Box, type BoxProps, type RecipeVariantProps, useRecipe } from "@chakra-ui/react";
import { simpleCardRecipe } from "../../theme/recipes/simple-card";

export interface SimpleCardProps extends BoxProps, RecipeVariantProps<typeof simpleCardRecipe> {}

export const SimpleCard = (props: SimpleCardProps) => {
  const { children, ...rest } = props;
  const recipe = useRecipe({ recipe: simpleCardRecipe });
  const [variants, boxProps] = recipe.splitVariantProps(rest);

  return (
    <Box css={recipe(variants)} {...boxProps}>
      {children}
    </Box>
  );
};

export type SimpleCardBodyProps = BoxProps;

export const SimpleCardBody = (props: SimpleCardBodyProps) => {
  const { children, ...rest } = props;

  return (
    <Box p="var(--simple-card-body-padding, var(--chakra-spacing-md))" {...rest}>
      {children}
    </Box>
  );
};
