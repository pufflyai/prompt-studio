import { Box, Button, HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import { ScopedDialog as Dialog, Portal, SearchModalContent, type TreeVisibilityItem } from "@pstdio/ui";
import { useRef, useState } from "react";
import { WorkbenchIcon } from "../../shared/icon";

interface TreeVisibilityDialogProps {
  items: TreeVisibilityItem[];
  onReset(): void;
  onClose(): void;
  returnFocus(): HTMLElement | null;
}

const VisibilityRow = ({ item, group = false }: { item: TreeVisibilityItem; group?: boolean }) => {
  const action = `${item.visible ? "Hide" : "Show"} ${item.label}`;
  return (
    <HStack justify="space-between" gap="sm">
      <HStack minW="0" gap="sm">
        <Box display="inline-flex" alignItems="center" justifyContent="center" boxSize="4" flexShrink={0} aria-hidden>
          {item.icon ?? (group ? <WorkbenchIcon name="folder" size={14} /> : null)}
        </Box>
        <Text textStyle="label/M/regular" truncate title={item.label}>
          {item.label}
        </Text>
      </HStack>
      <IconButton size="sm" variant="ghost" aria-label={action} title={action} onClick={item.toggle} flexShrink={0}>
        <WorkbenchIcon name={item.visible ? "eye" : "eye-off"} size={14} />
      </IconButton>
    </HStack>
  );
};

export const TreeVisibilityDialog = (props: TreeVisibilityDialogProps) => {
  const { items, onReset, onClose, returnFocus } = props;
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const filter = query.trim().toLocaleLowerCase();
  const matches = ({ label, section }: TreeVisibilityItem) =>
    label.toLocaleLowerCase().includes(filter) || section?.toLocaleLowerCase().includes(filter);
  const children = new Map<string, TreeVisibilityItem[]>();
  for (const item of items) {
    if (!item.parentKey) continue;
    const siblings = children.get(item.parentKey) ?? [];
    siblings.push(item);
    children.set(item.parentKey, siblings);
  }
  const rows = items
    .filter((item) => !item.parentKey)
    .map((item) => ({ item, children: (children.get(item.key) ?? []).filter(matches) }))
    .filter(({ item, children }) => matches(item) || children.length > 0);

  return (
    <Dialog.Root
      open
      initialFocusEl={() => input.current}
      finalFocusEl={returnFocus}
      onOpenChange={({ open }) => {
        if (!open) {
          const focus = returnFocus();
          onClose();
          requestAnimationFrame(() => focus?.focus({ preventScroll: true }));
        }
      }}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <SearchModalContent
              title="Hide/show items"
              searchPlaceholder="Search navigation items"
              searchInputRef={input}
              searchIcon={<WorkbenchIcon name="search" />}
              searchValue={query}
              onSearchChange={setQuery}
              footerEnd={
                <Button size="sm" variant="ghost" onClick={onReset}>
                  Reset to default
                </Button>
              }
            >
              {rows.length > 0 ? (
                <Stack as="ul" listStyle="none" gap="xs" p="sm">
                  {rows.map(({ item, children: visibleChildren }) => (
                    <Stack as="li" key={item.key} gap="0">
                      <VisibilityRow item={item} group={children.has(item.key)} />
                      {visibleChildren.length > 0 ? (
                        <Stack as="ul" aria-label={item.label} listStyle="none" gap="0" ps="lg">
                          {visibleChildren.map((child) => (
                            <Box as="li" key={child.key}>
                              <VisibilityRow item={child} />
                            </Box>
                          ))}
                        </Stack>
                      ) : null}
                    </Stack>
                  ))}
                </Stack>
              ) : (
                <Text color="fg.muted" role="status" p="sm">
                  No matching navigation items
                </Text>
              )}
            </SearchModalContent>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
