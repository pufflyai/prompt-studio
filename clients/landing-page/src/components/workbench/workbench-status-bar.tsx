import { Box, Button, HStack, Text } from "@chakra-ui/react";
import { Building2, Scale, ShieldCheck } from "lucide-react";
import { useLandingStyles } from "../../hooks/use-landing-styles";
import { StockholmIcon } from "../icons/stockholm-icon";

const LEGAL_LINKS = [
  { label: "Privacy", path: "/privacy/", icon: ShieldCheck },
  { label: "Terms", path: "/terms/", icon: Scale },
  { label: "Imprint", path: "/imprint/", icon: Building2 },
];

export const WorkbenchStatusBar = () => {
  const styles = useLandingStyles();

  return (
    <HStack as="footer" aria-label="Workbench status" css={styles.status}>
      {LEGAL_LINKS.map((item) => (
        <Button key={item.path} asChild size="xs" variant="ghost" color="fg.muted">
          <a href={item.path}>
            <item.icon />
            {item.label}
          </a>
        </Button>
      ))}
      <HStack gap="xs" color="fg" ms="auto" flexShrink="0">
        <Box boxSize="icon-md" flexShrink="0">
          <StockholmIcon />
        </Box>
        <Text css={styles.copyright}>© Pufflig AB. Stockholm, 2026</Text>
      </HStack>
    </HStack>
  );
};
