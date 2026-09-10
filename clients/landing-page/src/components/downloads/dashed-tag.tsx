import { HStack, Link, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

interface DashedTagProps {
  icon: ReactNode;
  label: string;
  href?: string;
  tone?: "anthropic" | "openai" | "opencode";
  invertedOnHover?: boolean;
}

export const DashedTag = (props: DashedTagProps) => {
  const { icon, label, href, tone, invertedOnHover = false } = props;

  const colorPalette = {
    anthropic: "orange",
    openai: "green",
    opencode: "blue",
  }[tone ?? "openai"];

  const content = (
    <>
      {icon}
      <Text fontFamily="mono" fontSize="11px" letterSpacing="1.2px">
        {label}
      </Text>
    </>
  );

  const sharedProps = {
    gap: "6px",
    px: "12px",
    py: "6px",
    borderWidth: "1px",
    borderStyle: "dashed",
    borderColor: "fg.subtle",
    color: "fg.muted",
  } as const;

  if (href) {
    return (
      <HStack
        asChild
        {...sharedProps}
        colorPalette={colorPalette}
        transition="background 120ms ease, color 120ms ease, border-color 120ms ease, transform 120ms ease"
        _hover={{
          bg: invertedOnHover ? "blacks.900" : "colorPalette.subtle",
          color: invertedOnHover ? "blacks.50" : "colorPalette.fg",
          borderColor: invertedOnHover ? "blacks.900" : "colorPalette.muted",
          textDecoration: "none",
          transform: "translateY(-2px)",
        }}
        _focusVisible={{
          bg: "colorPalette.subtle",
          color: "colorPalette.fg",
          borderColor: "colorPalette.muted",
          outlineWidth: "1px",
          outlineColor: "colorPalette.focusRing",
        }}
      >
        <Link href={href} target="_blank" rel="noopener">
          {content}
        </Link>
      </HStack>
    );
  }

  return <HStack {...sharedProps}>{content}</HStack>;
};
