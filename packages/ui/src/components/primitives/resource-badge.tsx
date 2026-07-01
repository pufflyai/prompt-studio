import type { HTMLChakraProps } from "@chakra-ui/react";
import { chakra, IconButton, Spacer, Text } from "@chakra-ui/react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, X } from "lucide-react";
import type { ReactNode } from "react";
import { Tooltip } from "@/components/primitives/tooltip";
import { getFileTypeIcon } from "@/utils/get-file-type-icon";

const SIZE_STYLES = {
  sm: {
    container: {
      height: "20px",
      lineHeight: { base: "20px" },
      px: "2xs",
    },
    iconSize: 12,
    textStyle: "xs",
  },
  md: {
    container: {
      height: "24px",
      lineHeight: { base: "24px" },
      px: "xs",
    },
    iconSize: 14,
    textStyle: "sm",
  },
} as const;

const TONE_STYLES = {
  neutral: {
    color: "color.primary",
    bg: "bg.muted",
    _hover: {
      bg: "bg.emphasized",
    },
  },
  accent: {
    color: "var(--schub-foreground-accent)",
    bg: "var(--schub-accent-subtle)",
    _hover: {
      bg: "var(--schub-accent-subtle)",
    },
  },
} as const;

export interface MissingResourceBadgeProps {
  referenceId: string;
  onRemove?: (referenceId: string) => void;
}

/**
 * Shown when a reference points to a resource that no longer exists
 */
export const MissingResourceBadge = (props: MissingResourceBadgeProps) => {
  const { referenceId, onRemove } = props;
  return (
    <chakra.span
      height="24px"
      lineHeight={{ base: "24px" }}
      gap="2xs"
      display="flex"
      flexDirection="row"
      alignItems="center"
      paddingX="xs"
      borderRadius="9999px"
      color="blacks.50"
      bg="red.500"
      _hover={{
        bg: "red.600",
      }}
    >
      <chakra.span mr="xs" display="inline-flex">
        <AlertTriangle size={14} />
      </chakra.span>
      <Text maxW={{ base: "17.5rem" }} textOverflow="ellipsis" whiteSpace="nowrap" overflow="hidden">
        Missing Reference
      </Text>
      <Spacer />
      {onRemove && (
        <IconButton
          color="blacks.50"
          aria-label="Remove reference"
          size="2xs"
          ml="sm"
          variant="ghost"
          _hover={{
            bg: "transparent",
          }}
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.(referenceId);
          }}
        >
          <X size={12} />
        </IconButton>
      )}
    </chakra.span>
  );
};

export type ResourceBadgeSize = keyof typeof SIZE_STYLES;
export type ResourceBadgeTone = keyof typeof TONE_STYLES;

export interface ResourceBadgeProps extends Omit<HTMLChakraProps<"span">, "onSelect"> {
  fileName: string;
  onRemove?: (fileName: string) => void;
  onSelect?: (fileName: string) => void;
  size?: ResourceBadgeSize;
  tone?: ResourceBadgeTone;
  icon?: ReactNode;
}

const DEFAULT_SIZE: ResourceBadgeSize = "md";
const DEFAULT_TONE: ResourceBadgeTone = "neutral";

export const ResourceBadge = (props: ResourceBadgeProps) => {
  const { fileName, onSelect, onRemove, size = DEFAULT_SIZE, tone = DEFAULT_TONE, icon, ...rest } = props;
  const IconComp: LucideIcon = getFileTypeIcon(fileName);
  const sizeStyles = SIZE_STYLES[size];
  const toneStyles = TONE_STYLES[tone];

  return (
    <chakra.span
      display="flex"
      flexDirection="row"
      alignItems="center"
      borderRadius="9999px"
      gap="2xs"
      cursor={onSelect ? "pointer" : "default"}
      {...toneStyles}
      {...sizeStyles.container}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(fileName);
      }}
      {...rest}
    >
      <chakra.span mr="xs" display="inline-flex">
        {icon ?? <IconComp size={sizeStyles.iconSize} />}
      </chakra.span>
      <Tooltip content={fileName}>
        <Text
          maxW={{ base: "14rem" }}
          textOverflow="ellipsis"
          whiteSpace="nowrap"
          overflow="hidden"
          textStyle={sizeStyles.textStyle}
        >
          {fileName}
        </Text>
      </Tooltip>
      <Spacer />
      {onRemove && (
        <IconButton
          aria-label={`Remove ${fileName}`}
          size="2xs"
          ml="xs"
          variant="ghost"
          _hover={{
            bg: "transparent",
          }}
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.(fileName);
          }}
        >
          <X size={12} />
        </IconButton>
      )}
    </chakra.span>
  );
};
