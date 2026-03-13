import { Box, Flex, Stack, Text } from "@chakra-ui/react";
import { LinkGroup } from "./link-group";
import { StockholmIcon } from "./stockholm-icon";

interface FooterProps {
  links: { item: string; url: string }[];
}

export const Footer = (props: FooterProps) => {
  const { links } = props;
  const horizontalPadding = ["1.5rem", "3.75rem"];

  return (
    <Flex as="footer" id="footer" justifyContent="center" position="relative" direction="column" zIndex="1">
      <Flex bg="white" pb="2rem" px={horizontalPadding}>
        <Stack gap="2.5rem" direction={["column", "row"]} justifyContent="space-between" width="100%" flexWrap="wrap">
          <LinkGroup items={links} />
          <Flex mt={["2.5rem", "2.5rem", "0"]} gap="2rem" alignSelf="flex-end" flexWrap="wrap">
            <Flex width="3rem">
              <StockholmIcon />
            </Flex>
            <Box>
              <Text fontSize={["md", "lg"]}>© Pufflig AB.</Text>
              <Text fontSize={["md", "lg"]} as="span" fontWeight="500">
                Stockholm, {new Date().getFullYear()}
              </Text>
            </Box>
          </Flex>
        </Stack>
      </Flex>
    </Flex>
  );
};

export default Footer;
