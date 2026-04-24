import { Flex, IconButton, Text } from "@chakra-ui/react";
import { useThemePreference } from "@pstdio/ui";
import { Moon, Sun } from "lucide-react";
import { TextLogo } from "./text-logo";

interface HeaderProps {
  activeSection?: "blog" | "docs";
}

const ThemeToggle = () => {
  const { toggleThemePreference } = useThemePreference();

  return (
    <IconButton
      aria-label="Toggle theme"
      variant="ghost"
      size="sm"
      color="fg.muted"
      onClick={toggleThemePreference}
      _hover={{ color: "fg" }}
    >
      <span className="theme-toggle__icon theme-toggle__icon--moon" aria-hidden="true">
        <Moon size={18} />
      </span>
      <span className="theme-toggle__icon theme-toggle__icon--sun" aria-hidden="true">
        <Sun size={18} />
      </span>
    </IconButton>
  );
};

export const Header = (props: HeaderProps) => {
  const { activeSection } = props;
  const isBlogActive = activeSection === "blog";
  const isDocsActive = activeSection === "docs";

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
        <a href="/docs/">
          <Text
            textStyle="paragraph/L/regular"
            fontWeight="500"
            color={isDocsActive ? "fg" : "fg.muted"}
            textDecoration={isDocsActive ? "underline" : "none"}
            textUnderlineOffset="0.2em"
            _hover={{ color: "fg", textDecoration: "underline" }}
          >
            Docs
          </Text>
        </a>
        <ThemeToggle />
      </Flex>
    </Flex>
  );
};

export default Header;
