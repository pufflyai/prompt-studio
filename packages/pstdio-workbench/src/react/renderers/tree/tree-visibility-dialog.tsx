import { Button, Stack, Text } from "@chakra-ui/react";
import { ScopedDialog as Dialog, Portal, SearchModalContent, Switch, type TreeVisibilityItem } from "@pstdio/ui";
import { useRef, useState } from "react";
import { WorkbenchIcon } from "../../shared/icon";

interface TreeVisibilityDialogProps {
  items: TreeVisibilityItem[];
  onReset(): void;
  onClose(): void;
  returnFocus(): HTMLElement | null;
}

export const TreeVisibilityDialog = (props: TreeVisibilityDialogProps) => {
  const { items, onReset, onClose, returnFocus } = props;
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const filter = query.trim().toLocaleLowerCase();
  const matches = items.filter(
    ({ label, section }) => label.toLocaleLowerCase().includes(filter) || section?.toLocaleLowerCase().includes(filter),
  );

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
              <Stack gap="sm" p="sm">
                {matches.map((item) => (
                  <Switch
                    key={item.key}
                    inputProps={{ "aria-label": item.label }}
                    checked={item.visible}
                    onCheckedChange={item.toggle}
                    size="sm"
                  >
                    {item.label}
                    {item.section && item.section !== item.label ? (
                      <Text as="span" color="fg.muted" ms="xs">
                        {item.section}
                      </Text>
                    ) : null}
                  </Switch>
                ))}
                {matches.length === 0 ? (
                  <Text color="fg.muted" role="status">
                    No matching navigation items
                  </Text>
                ) : null}
              </Stack>
            </SearchModalContent>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
