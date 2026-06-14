import type { HTMLChakraProps } from "@chakra-ui/react";
import { chakra, Text } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import { Component } from "lucide-react";

interface TicketBadgeProps extends Omit<HTMLChakraProps<"span">, "onSelect"> {
  label: string;
  title?: string;
  onSelect?: () => void;
}

export const TicketBadge = (props: TicketBadgeProps) => {
  const { label, title, onSelect, ...rest } = props;

  return (
    <chakra.span
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      display="inline-flex"
      alignItems="center"
      h="20px"
      minW="0"
      gap="2xs"
      px="2xs"
      borderRadius="xs"
      borderWidth="1px"
      borderColor={onSelect ? "border" : "transparent"}
      bg="bg.muted"
      color="fg"
      cursor={onSelect ? "pointer" : "default"}
      lineHeight={{ base: "20px" }}
      _hover={onSelect ? { bg: "bg.emphasized" } : undefined}
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.();
      }}
      onKeyDown={(event) => {
        if (!onSelect || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        onSelect();
      }}
      {...rest}
    >
      <chakra.span display="inline-flex" color="fg.muted">
        <Component size={12} />
      </chakra.span>
      <Tooltip content={title ?? label}>
        <Text as="span" maxW="14rem" textStyle="xs" textOverflow="ellipsis" whiteSpace="nowrap" overflow="hidden">
          {label}
        </Text>
      </Tooltip>
    </chakra.span>
  );
};
