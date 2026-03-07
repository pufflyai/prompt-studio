import { Span } from "@chakra-ui/react";
import type React from "react";
import type { ComponentProps, MouseEvent } from "react";

interface DiffBubbleProps extends Omit<ComponentProps<typeof Span>, "onClick"> {
  fileName?: string;
  additions: number;
  deletions: number;
  label?: React.ReactNode;
  variant?: "outline" | "ghost";
  size?: "default" | "small";
  onClick?: (event: MouseEvent<HTMLSpanElement>) => void;
  onClickFileLink?: () => void;
}

export const DiffBubble = (props: DiffBubbleProps) => {
  const {
    fileName,
    additions,
    deletions,
    label,
    variant = "outline",
    size = "default",
    onClick,
    onClickFileLink,
  } = props;

  const isSmall = size === "small";

  return (
    <Span
      display="inline-flex"
      alignItems="center"
      gap={"2xs"}
      border={variant === "outline" ? "1px solid" : "none"}
      borderColor="border.muted"
      color="fg.muted"
      paddingX={variant === "outline" ? (isSmall ? "3xs" : "2xs") : "2px"}
      paddingY="1px"
      borderRadius="xs"
      textStyle={isSmall ? "label/S/regular" : undefined}
      cursor={onClick ? "pointer" : "default"}
      onClick={onClick}
      _hover={{
        background: "bg.muted",
      }}
    >
      {label}
      {fileName && (
        <Span
          display="inline-block"
          maxW="24ch"
          truncate
          mr="xs"
          title={fileName}
          onClick={(e) => {
            e.stopPropagation();
            onClickFileLink?.();
          }}
          cursor={onClickFileLink ? "pointer" : "default"}
          _hover={{
            textDecoration: onClickFileLink ? "underline" : "none",
            color: onClickFileLink ? "fg.blue-dark" : "fg.muted",
          }}
        >
          {fileName}
        </Span>
      )}
      <Span color="fg.success">{`+${additions}`}</Span>
      <Span color="fg.error">{`-${deletions}`}</Span>
    </Span>
  );
};
