import { HStack, Icon, IconButton, Input, Text } from "@chakra-ui/react";
import { Search, X } from "lucide-react";
import { useRef, useState } from "react";
import { Tooltip } from "@/components/primitives/tooltip";

export interface ViewSearchFieldProps {
  value: string;
  onValueChange: (value: string) => void;
  /** How many rows or cards match, such as "4 of 10". Shown while the field has text. */
  resultLabel?: string;
}

/** Starts as an icon button. Escape or the clear button empties it and folds it back. */
export const ViewSearchField = (props: ViewSearchFieldProps) => {
  const { value, onValueChange, resultLabel } = props;
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const close = () => {
    onValueChange("");
    setOpen(false);
  };

  if (!open && !value) {
    return (
      <Tooltip content="Search">
        <IconButton
          aria-label="Search this view"
          variant="ghost"
          size="2xs"
          onClick={() => {
            setOpen(true);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
        >
          <Icon as={Search} />
        </IconButton>
      </Tooltip>
    );
  }

  return (
    <HStack
      data-testid="view-search-field"
      width="13.75rem"
      height="filter-pill"
      gap="2xs"
      paddingX="xs"
      borderWidth="1px"
      borderColor="border"
      borderRadius="xs"
      bg="bg.subtle"
      flexShrink={0}
    >
      <Icon as={Search} boxSize="0.75rem" color="fg.muted" flexShrink={0} />
      <Input
        ref={inputRef}
        autoFocus
        aria-label="Search this view"
        value={value}
        placeholder="Search…"
        variant="borderless"
        size="2xs"
        height="full"
        padding="0"
        textStyle="label/S/regular"
        onChange={(event) => onValueChange(event.target.value)}
        onBlur={() => !value && setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "Escape") close();
        }}
      />
      {value && resultLabel ? (
        <Text textStyle="label/XS" color="fg.subtle" flexShrink={0}>
          {resultLabel}
        </Text>
      ) : null}
      <IconButton aria-label="Close search" variant="ghost" size="2xs" minW="1rem" h="1rem" onClick={close}>
        <Icon as={X} boxSize="0.6875rem" color="fg.subtle" />
      </IconButton>
    </HStack>
  );
};
