// Match the Planner's compact search control, with Escape and clear restoring the full view.
import { HStack, Icon, IconButton, Input, Text } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import { Search, X } from "lucide-react";
import { useState } from "react";

export function TimelineSearch({
  value,
  onChange,
  resultLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  resultLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const close = () => {
    onChange("");
    setOpen(false);
  };
  if (!open && !value) {
    return (
      <Tooltip content="Search">
        <IconButton aria-label="Search this view" variant="ghost" size="2xs" onClick={() => setOpen(true)}>
          <Icon as={Search} />
        </IconButton>
      </Tooltip>
    );
  }

  return (
    <HStack
      width="13.75rem"
      maxW="40vw"
      height="1.75rem"
      gap="2xs"
      paddingX="xs"
      borderWidth="1px"
      borderColor="border"
      borderRadius="xs"
      bg="bg.subtle"
      flexShrink="0"
    >
      <Icon as={Search} boxSize="0.75rem" color="fg.muted" flexShrink="0" />
      <Input
        autoFocus
        aria-label="Search this view"
        value={value}
        placeholder="Search…"
        variant="flushed"
        size="2xs"
        height="full"
        padding="0"
        border="0"
        textStyle="label/S/regular"
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => !value && setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            close();
          }
        }}
      />
      {value ? (
        <Text textStyle="label/XS" color="fg.subtle" flexShrink="0">
          {resultLabel}
        </Text>
      ) : null}
      <IconButton aria-label="Close search" variant="ghost" size="2xs" minW="1rem" h="1rem" onClick={close}>
        <Icon as={X} boxSize="0.6875rem" color="fg.subtle" />
      </IconButton>
    </HStack>
  );
}
