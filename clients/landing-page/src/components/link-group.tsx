import { Link as ChakraLink, Stack, Text } from "@chakra-ui/react";
import { Link } from "gatsby";

interface LinkGroupProps {
  items: { item: string; url: string }[];
  variant?: "stack" | "inline";
}

export const LinkGroup = (props: LinkGroupProps) => {
  const { items, variant = "stack" } = props;

  const isExternalUrl = (url: string) => url.startsWith("http://") || url.startsWith("https://");

  return (
    <Stack
      gap="1rem"
      direction={variant === "inline" ? "row" : "column"}
      alignItems={variant === "inline" ? "center" : undefined}
    >
      {items.map((item) =>
        isExternalUrl(item.url) ? (
          <ChakraLink
            key={item.url}
            href={item.url}
            target="_blank"
            rel="noreferrer"
            textStyle="paragraph/L/regular"
            textDecoration="none"
            color="inherit"
            _hover={{ textDecoration: "underline" }}
          >
            {item.item}
          </ChakraLink>
        ) : (
          <Link key={item.url} to={item.url}>
            <Text textStyle="paragraph/L/regular" _hover={{ textDecoration: "underline" }}>
              {item.item}
            </Text>
          </Link>
        ),
      )}
    </Stack>
  );
};
