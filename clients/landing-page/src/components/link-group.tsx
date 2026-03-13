import { Link as ChakraLink, Stack, Text } from "@chakra-ui/react";

interface LinkGroupProps {
  items: { item: string; url: string }[];
}

export const LinkGroup = (props: LinkGroupProps) => {
  const { items } = props;

  const isExternalUrl = (url: string) => url.startsWith("http://") || url.startsWith("https://");

  return (
    <Stack gap="1rem" direction={["column", "row"]} alignItems={["flex-start", "center"]}>
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
          <a key={item.url} href={item.url}>
            <Text textStyle="paragraph/L/regular" _hover={{ textDecoration: "underline" }}>
              {item.item}
            </Text>
          </a>
        ),
      )}
    </Stack>
  );
};
