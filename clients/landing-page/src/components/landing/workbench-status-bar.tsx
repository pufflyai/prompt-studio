import { Box, Flex, HStack, Link, Text } from "@chakra-ui/react";
import { StockholmIcon } from "@pstdio/ui";
import { GitBranch } from "lucide-react";
import type { LandingView } from "./landing-content";

interface WorkbenchStatusBarProps {
  label: string;
  onNavigate: (view: LandingView) => void;
  onOpenChangelog: () => void;
}

export const WorkbenchStatusBar = (props: WorkbenchStatusBarProps) => {
  const { label, onNavigate, onOpenChangelog } = props;

  return (
    <HStack
      as="footer"
      aria-label="Workbench status"
      height="28px"
      flexShrink="0"
      gap="14px"
      px="12px"
      bg="bg.subtle"
      borderTopWidth="1px"
      borderColor="border"
      color="fg.muted"
      display={{ base: "none", md: "flex" }}
    >
      <HStack as="button" gap="8px" fontFamily="mono" fontSize="9px" onClick={onOpenChangelog}>
        <GitBranch size={10} />
        <Text>{label}</Text>
      </HStack>
      <Flex flex="1" />
      <HStack gap="6px" color="fg.subtle">
        <Box width="11px" height="11px">
          <StockholmIcon />
        </Box>
        <Text fontFamily="body" fontSize="9px">
          © Pufflig AB. Stockholm, 2026
        </Text>
      </HStack>
      {[
        { label: "Privacy", view: "privacy" as const, href: "/privacy" },
        { label: "Terms", view: "terms" as const, href: "/terms" },
      ].map((item) => (
        <Link
          key={item.view}
          href={item.href}
          fontFamily="body"
          fontSize="9px"
          color="fg.muted"
          _hover={{ color: "fg", textDecoration: "none" }}
          onClick={(event) => {
            event.preventDefault();
            onNavigate(item.view);
          }}
        >
          {item.label}
        </Link>
      ))}
    </HStack>
  );
};
