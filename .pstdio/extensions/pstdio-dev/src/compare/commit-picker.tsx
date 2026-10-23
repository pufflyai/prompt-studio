import { Box, HStack, Input, Popover, Portal, Stack, Text } from "@chakra-ui/react";
import { ScrollArea, SimpleCard } from "@pstdio/ui";
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
}

const matches = (option: CommitOptionView, query: string) =>
  `${option.sha} ${option.ref} ${option.message}`.toLowerCase().includes(query.trim().toLowerCase());

// The whole card opens the picker, so choosing a commit happens where the commit is shown.
export const CommitPicker = (props: CommitPickerProps) => {
  const { label, color, value, options, onChange } = props;
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
      <Popover.Trigger asChild>
        <SimpleCard
          as="button"
          flex="1 1 20rem"
          minW="0"
          p="md"
          textAlign="start"
          display="flex"
          flexDirection="column"
          gap="2xs"
          cursor="pointer"
          borderColor={open ? "border.accent" : "border.subtle"}
          _hover={{ bg: "bg.subtle" }}
          aria-label={`${label} commit: ${value ? shortSha(value.sha) : "none"}. Change`}
        >
          <HStack w="full" gap="xs" textStyle="label/S/regular" color="fg.muted">
            <Box boxSize="2.5" borderRadius="full" bg={color} />
            <Text flex="1">{label}</Text>
            <Text>Change</Text>
            <ChevronDown size={14} />
          </HStack>
          <HStack gap="xs" align="baseline">
            <Text textStyle="mono/S">{value ? shortSha(value.sha) : "Choose a commit"}</Text>
            <Text textStyle="label/S/regular" color="fg.muted">
              {value?.ref}
            </Text>
          </HStack>
          <Text textStyle="label/S/regular" color="fg.muted" truncate w="full">
            {value?.message}
          </Text>
          {value ? (
            <Text textStyle="label/XS" color={value.measured ? "fg.muted" : "fg.warning"}>
              {value.measured ? "Has CI results" : "Not measured yet"}
            </Text>
          ) : null}
        </SimpleCard>
      </Popover.Trigger>
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
                      <Text textStyle="label/XS" color={option.measured ? "fg.muted" : "fg.warning"} flexShrink={0}>
                        {option.measured ? "Measured" : "Not measured"}
                      </Text>
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
