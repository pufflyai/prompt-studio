import { Button, Flex, Spacer, Stack } from "@chakra-ui/react";
import { Link } from "gatsby";
import { MobileDrawer } from "./mobile-drawer";
import { TextLogo } from "./text-logo";

interface HeaderLink {
  id?: string;
  label: string;
  url: string;
}

interface HeaderProps {
  menuItems?: HeaderLink[];
  actionItems?: HeaderLink[];
}

const toPagePath = (url: string) => {
  if (url.startsWith("/") || url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return `/${url}`;
};

export const Header = (props: HeaderProps) => {
  const { menuItems = [], actionItems = [] } = props;

  return (
    <Flex
      as="header"
      zIndex="9999"
      position={["fixed", "fixed", "fixed", "relative"]}
      top={0}
      left={0}
      right={0}
      px={["1.5rem", "3.75rem"]}
      py={["1rem", "1rem", "1rem", "2.5rem"]}
      alignItems="center"
      width="100%"
    >
      <Link to="/">
        <TextLogo />
      </Link>

      <Flex display={["none", "none", "none", "flex"]} alignItems="center" flex="1">
        <Spacer />

        <Stack direction="row" gap="sm">
          {menuItems.map((item, index) => (
            <Link key={item.id ?? index} to={toPagePath(item.url)}>
              <Button fontWeight="normal" variant="ghost">
                {item.label}
              </Button>
            </Link>
          ))}
        </Stack>

        <Spacer />

        <Flex gap="1">
          {actionItems.map((item, index) => (
            <Link key={item.id ?? index} to={toPagePath(item.url)}>
              <Button variant="solid">{item.label}</Button>
            </Link>
          ))}
        </Flex>
      </Flex>

      {menuItems.length > 0 ? <MobileDrawer menuItems={menuItems} /> : null}
    </Flex>
  );
};

export default Header;
