import { HStack, Input, Popover, Portal, Stack, Text } from "@chakra-ui/react";
import { Chip, ScrollArea } from "@pstdio/ui";
import { useState } from "react";
import { shortSha } from "../webview/format";

export interface RefOption {
  ref: string;
  sha: string;
  // Has results for the chosen suites and platforms, so a new run reuses them instead of measuring again.
  measured: boolean;
}

interface RefInputProps {
  options: RefOption[];
  chosen: string[];
  onAdd: (ref: string) => void;
}

// Opens on click with every tag, newest first. Typing filters them; Enter adds any branch or pushed SHA.
export const RefInput = (props: RefInputProps) => {
  const { options, chosen, onAdd } = props;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const typed = query.trim();
  const visible = options.filter(
    (option) =>
      !chosen.includes(option.ref) && `${option.ref} ${option.sha}`.toLowerCase().includes(typed.toLowerCase()),
  );
  const add = (ref: string) => {
    if (ref) onAdd(ref);
    setQuery("");
    setOpen(false);
  };
  return (
    <Popover.Root
      open={open}
      onOpenChange={(details) => setOpen(details.open)}
      autoFocus={false}
      lazyMount
      unmountOnExit
      positioning={{ placement: "bottom-start", sameWidth: true }}
    >
      <Popover.Anchor asChild>
        <Input
          size="sm"
          value={query}
          onClick={() => setOpen(true)}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") add(visible[0]?.ref ?? typed);
            if (event.key === "Escape") setOpen(false);
          }}
          placeholder="Add a tag, branch, or pushed SHA"
          aria-label="Add a commit, branch, or tag"
          aria-expanded={open}
          role="combobox"
        />
      </Popover.Anchor>
      <Portal>
        <Popover.Positioner>
          <Popover.Content>
            <Popover.Body p="2xs">
              <ScrollArea maxH="64">
                <Stack gap="0" role="listbox" aria-label="Tags">
                  {visible.map((option) => (
                    <HStack
                      key={option.ref}
                      as="button"
                      role="option"
                      aria-selected={false}
                      gap="sm"
                      px="sm"
                      py="xs"
                      borderRadius="xs"
                      textAlign="start"
                      _hover={{ bg: "bg.subtle" }}
                      onClick={() => add(option.ref)}
                    >
                      <Text textStyle="label/S/medium" flex="1" truncate>
                        {option.ref}
                      </Text>
                      <Text textStyle="mono/XS" color="fg.muted">
                        {shortSha(option.sha)}
                      </Text>
                      {option.measured ? <Chip>Measured</Chip> : null}
                    </HStack>
                  ))}
                  {typed && !visible.some((option) => option.ref === typed) ? (
                    <HStack
                      as="button"
                      role="option"
                      aria-selected={false}
                      px="sm"
                      py="xs"
                      borderRadius="xs"
                      textAlign="start"
                      _hover={{ bg: "bg.subtle" }}
                      onClick={() => add(typed)}
                    >
                      <Text textStyle="label/S/regular">
                        Add{" "}
                        <Text as="span" textStyle="mono/XS">
                          {typed}
                        </Text>
                      </Text>
                    </HStack>
                  ) : null}
                </Stack>
              </ScrollArea>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};
