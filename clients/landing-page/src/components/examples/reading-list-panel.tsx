import { Box, Button, Field, HStack, Input, Text } from "@chakra-ui/react";
import { Checkbox, ScrollArea } from "@pstdio/ui";
import { Plus } from "lucide-react";
import { useState } from "react";
import type { ReadingItem } from "../../content/purpose-demo-content";
import { usePurposeStyles } from "../../hooks/use-landing-styles";
import { DemoPanel } from "./demo-workbench";

interface ReadingListPanelProps {
  items: ReadingItem[];
  withFilter: boolean;
  onToggle: (id: string) => void;
  onAdd: (title: string) => void;
}

export const ReadingListPanel = (props: ReadingListPanelProps) => {
  const { items, withFilter, onToggle, onAdd } = props;
  const [filter, setFilter] = useState("unread");
  const [title, setTitle] = useState("");
  const styles = usePurposeStyles();
  const unread = items.filter((item) => !item.read);
  const visible = withFilter && filter === "unread" ? unread : items;
  return (
    <DemoPanel title="Reading list" kind="page">
      <Text textStyle="label/S/regular" color="fg.muted" role="status">
        {unread.length} unread · {items.length - unread.length} read
      </Text>
      {withFilter && (
        <HStack role="group" aria-label="Reading list filter">
          {["all", "unread"].map((value) => (
            <Button
              key={value}
              size="sm"
              variant={filter === value ? "subtle" : "ghost"}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {value === "all" ? "All" : "Unread"}
            </Button>
          ))}
        </HStack>
      )}
      <ScrollArea css={styles.list}>
        <Box as="ul" listStyle="none" aria-label="Reading items">
          {visible.map((item) => (
            <HStack as="li" key={item.id} css={styles.item}>
              <Checkbox
                checked={item.read}
                aria-label={`Mark ${item.title} as ${item.read ? "unread" : "read"}`}
                onCheckedChange={() => onToggle(item.id)}
              />
              <Text textStyle="paragraph/M/regular" color={item.read ? "fg.muted" : "fg"}>
                {item.title}
              </Text>
            </HStack>
          ))}
        </Box>
        {visible.length === 0 && (
          <Text p="md" role="status">
            All caught up.
          </Text>
        )}
      </ScrollArea>
      <Box
        as="form"
        css={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim()) return;
          onAdd(title.trim());
          setTitle("");
        }}
      >
        <Field.Root>
          <Field.Label>Add something to read</Field.Label>
          <Input
            aria-label="New reading item"
            placeholder="An article, book, or idea…"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field.Root>
        <Button type="submit" variant="outline" disabled={!title.trim()}>
          <Plus /> Add to reading list
        </Button>
      </Box>
    </DemoPanel>
  );
};
