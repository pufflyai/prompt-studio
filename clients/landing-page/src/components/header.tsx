import { Flex, Text } from "@chakra-ui/react";
import { TextLogo } from "./text-logo";

interface HeaderProps {
  activeSection?: "blog";
}

export const Header = (props: HeaderProps) => {
  const { activeSection } = props;
  const isBlogActive = activeSection === "blog";

  return (
    <Flex
      as="header"
      zIndex="9999"
      px={["1.5rem", "3.75rem"]}
      py={["1rem", "1rem", "1rem", "2.5rem"]}
      alignItems="center"
      justifyContent="space-between"
      gap="1.5rem"
      width="100%"
    >
      <a href="/" aria-label="Prompt Studio home">
        <TextLogo />
      </a>
      <Flex as="nav" aria-label="Main navigation" alignItems="center" gap={["1rem", "1.5rem"]}>
        <a href="/blog/">
          <Text
            textStyle="paragraph/L/regular"
            fontWeight="500"
            color={isBlogActive ? "fg" : "fg.muted"}
            textDecoration={isBlogActive ? "underline" : "none"}
            textUnderlineOffset="0.2em"
            _hover={{ color: "fg", textDecoration: "underline" }}
          >
            Blog
          </Text>
        </a>
      </Flex>
    </Flex>
  );
};

export default Header;
