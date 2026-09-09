import { Box, Button, Flex, HStack, Text } from "@chakra-ui/react";
import { Scale, ShieldCheck } from "lucide-react";
import type { LandingView } from "../../content/landing-content";
import { useLandingStyles } from "../../hooks/use-landing-styles";
import { StockholmIcon } from "../icons/stockholm-icon";

const LEGAL_LINKS = [
  { label: "Privacy", view: "privacy" as const, href: "/privacy", icon: ShieldCheck },
  { label: "Terms", view: "terms" as const, href: "/terms", icon: Scale },
];

interface WorkbenchStatusBarProps {
  onNavigate: (view: LandingView) => void;
}

export const WorkbenchStatusBar = (props: WorkbenchStatusBarProps) => {
  const { onNavigate } = props;

  const styles = useLandingStyles();

  return (
    <HStack as="footer" aria-label="Workbench status" css={styles.status}>
      {LEGAL_LINKS.map((item) => (
        <Button
          key={item.view}
          asChild
          size="xs"
          variant="ghost"
          color="fg.muted"
          onClick={(event) => {
            event.preventDefault();
            onNavigate(item.view);
          }}
        >
          <a href={item.href}>
            <item.icon />
            {item.label}
          </a>
        </Button>
      ))}
      <Flex flex="1" />
      <HStack gap={{ base: "4px", md: "6px" }} color="fg.subtle" minWidth="0">
        <Box width={{ base: "10px", md: "11px" }} height={{ base: "10px", md: "11px" }} flexShrink="0">
          <StockholmIcon />
        </Box>
        <Text fontFamily="body" fontSize={{ base: "7px", md: "9px" }} whiteSpace="nowrap">
          © Pufflig AB. Stockholm, 2026
        </Text>
      </HStack>
    </HStack>
  );
};
