import { Box, type BoxProps, Text, type TextProps } from "@chakra-ui/react";

export interface ContentPlaceholderProps extends BoxProps {}

export const contentPlaceholderBackgroundImage = `url("data:image/svg+xml,%3Csvg width='6' height='6' viewBox='0 0 6 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%239C92AC' fill-opacity='0.2' fillRule='evenodd'%3E%3Cpath d='M5 0h1L0 6V5zM6 5v1H5z'/%3E%3C/g%3E%3C/svg%3E")`;

export const ContentPlaceholder = (props: ContentPlaceholderProps) => (
  <Box
    {...props}
    css={{
      backgroundClip: "padding-box",
      backgroundImage: contentPlaceholderBackgroundImage,
      display: "flex",
      width: "100%",
    }}
  />
);

export const Label = (props: TextProps) => (
  <Box p="2">
    <Text color="fg.muted" fontWeight="medium" textStyle="sm" whiteSpace="nowrap" {...props} />
  </Box>
);
