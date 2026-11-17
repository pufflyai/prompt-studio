import { Box, Button, HStack, Input, Popover, Portal, Stack, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { shortSha } from "../webview/format";

export interface CommitOptionView {
  sha: string;
  ref: string;
  message: string;
  measured: boolean;
}

interface CommitPickerProps {
  label: "Base" | "Head";
  color: string;
  value?: CommitOptionView;
  options: CommitOptionView[];
  onChange: (sha: string) => void;
  // Offers "No base", so the head's own results show without a comparison.
  onClear?: () => void;
}

const matches = (option: CommitOptionView, query: string) =>
  `${option.sha} ${option.ref} ${option.message}`.toLowerCase().includes(query.trim().toLowerCase());

// A compact header trigger keeps the full commit details in the searchable picker.
export const CommitPicker = (props: CommitPickerProps) => {
  const { label, color, value, options, onChange, onClear } = props;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const visible = options.filter((option) => matches(option, query));
  return (
    <Popover.Root
      open={open}
      onOpenChange={(details) => {
        setOpen(details.open);
        setQuery("");
      }}
      lazyMount
      unmountOnExit
      positioning={{ placement: "bottom-start", fitViewport: true }}
    >
      <Popover.Trigger asChild>
        <Button
          size="xs"
          variant="outline"
          aria-label={`Change ${label.toLowerCase()} commit: ${value ? shortSha(value.sha) : "None"}`}
        >
          <Box boxSize="2.5" borderRadius="full" bg={color} flexShrink={0} />
          <Text color="fg.muted">{label}</Text>
          <Text textStyle="mono/XS">{value ? shortSha(value.sha) : "None"}</Text>
          <ChevronDown />
        </Button>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content w="sm">
            <Popover.Body display="flex" flexDirection="column" gap="xs">
              <Input
                size="sm"
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search commit, branch, or tag"
                aria-label="Search commits"
              />
              <ScrollArea maxH="80">
                <Stack gap="0" role="listbox" aria-label={`${label} commit`}>
                  {onClear && !query ? (
                    <HStack
                      as="button"
                      role="option"
                      aria-selected={!value}
                      px="sm"
                      py="xs"
                      borderRadius="xs"
                      textAlign="start"
                      bg={value ? undefined : "bg.subtle"}
                      _hover={{ bg: "bg.subtle" }}
                      onClick={() => {
                        onClear();
                        setOpen(false);
                      }}
                    >
                      <Stack gap="0">
                        <Text textStyle="label/S/medium">No {label.toLowerCase()}</Text>
                        <Text textStyle="label/XS" color="fg.muted">
                          Show the other commit's own results
                        </Text>
                      </Stack>
                    </HStack>
                  ) : null}
                  {visible.map((option) => (
                    <HStack
                      key={option.sha}
                      as="button"
                      role="option"
                      aria-selected={option.sha === value?.sha}
                      gap="sm"
                      px="sm"
                      py="xs"
                      borderRadius="xs"
                      textAlign="start"
                      bg={option.sha === value?.sha ? "bg.subtle" : undefined}
                      _hover={{ bg: "bg.subtle" }}
                      onClick={() => {
                        onChange(option.sha);
                        setOpen(false);
                      }}
                    >
                      <Text textStyle="mono/XS" flexShrink={0} w="16">
                        {shortSha(option.sha)}
                      </Text>
                      <Stack gap="0" flex="1" minW="0">
                        <Text textStyle="label/S/medium">{option.ref}</Text>
                        <Text textStyle="label/XS" color="fg.muted" truncate>
                          {option.message}
                        </Text>
                      </Stack>
                      {option.measured ? null : (
                        <Text textStyle="label/XS" color="fg.muted" flexShrink={0}>
                          Not measured
                        </Text>
                      )}
                    </HStack>
                  ))}
                  {visible.length ? null : (
                    <Text textStyle="label/S/regular" color="fg.muted" p="sm">
                      No matching commits.
                    </Text>
                  )}
                </Stack>
              </ScrollArea>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};
