import { Flex } from "@chakra-ui/react";
import { TextLogo } from "./text-logo";

export const Header = () => {
  return (
    <Flex
      as="header"
      zIndex="9999"
      px={["1.5rem", "3.75rem"]}
      py={["1rem", "1rem", "1rem", "2.5rem"]}
      alignItems="center"
      width="100%"
    >
      <a href="/">
        <TextLogo />
      </a>
    </Flex>
  );
};

export default Header;
