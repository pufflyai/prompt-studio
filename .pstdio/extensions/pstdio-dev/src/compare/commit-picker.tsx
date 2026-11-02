import { Box, Button, HStack, Input, Popover, Portal, Stack, Text } from "@chakra-ui/react";
import { ScrollArea, SimpleCard } from "@pstdio/ui";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { CopySha } from "../webview/copy-sha";
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

// Change opens the picker under the card; the hash copies, so the card itself is not one big button.
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
      positioning={{ placement: "bottom-start", sameWidth: true }}
    >
      <Popover.Anchor asChild>
        <SimpleCard
          flex="1 1 20rem"
          minW="0"
          p="md"
          display="flex"
          flexDirection="column"
          gap="2xs"
          borderColor={open ? "border.accent" : "border.subtle"}
        >
          <HStack w="full" gap="xs" textStyle="label/S/regular" color="fg.muted">
            <Box boxSize="2.5" borderRadius="full" bg={color} />
            <Text flex="1">{label}</Text>
            <Popover.Trigger asChild>
              <Button size="2xs" variant="ghost" aria-label={`Change ${label.toLowerCase()} commit`}>
                Change
                <ChevronDown />
              </Button>
            </Popover.Trigger>
          </HStack>
          <HStack gap="xs" align="center" minH="6">
            {value ? (
              <CopySha sha={value.sha} />
            ) : (
              <Text textStyle="label/S/regular" color="fg.muted">
                No commit chosen
              </Text>
            )}
            <Text textStyle="label/S/regular" color="fg.muted">
              {value?.ref}
            </Text>
          </HStack>
          <Text textStyle="label/S/regular" color="fg.muted" truncate w="full">
            {value?.message}
          </Text>
        </SimpleCard>
      </Popover.Anchor>
      <Portal>
        <Popover.Positioner>
          <Popover.Content>
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
