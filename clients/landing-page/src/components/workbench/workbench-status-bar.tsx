import { chakra, HStack } from "@chakra-ui/react";
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
    <HStack as="footer" aria-label="Workbench status" align="stretch" css={styles.status}>
      {LEGAL_LINKS.map((item) => (
        <chakra.a key={item.path} href={item.path} css={styles.statusLink}>
          <item.icon />
          {item.label}
        </chakra.a>
      ))}
      {/* The company widget sits at the trailing end, like the app's right-aligned status widgets. */}
      <chakra.a href="/imprint/" css={styles.statusLink} ms="auto">
        <StockholmIcon />© Pufflig AB · Stockholm 2026
      </chakra.a>
    </HStack>
  );
};
