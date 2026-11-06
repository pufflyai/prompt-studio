import { Box, type HTMLChakraProps, useSlotRecipe } from "@chakra-ui/react";

/** The shared dialog footer for a form hosted in its own document, such as a webview. */
export const DialogFormFooter = (props: HTMLChakraProps<"div">) => {
  const recipe = useSlotRecipe({ key: "dialog" });
  return <Box css={recipe().footer} {...props} />;
};
