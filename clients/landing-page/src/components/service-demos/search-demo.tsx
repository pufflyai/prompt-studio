import { Box, HStack, Input, InputGroup, Kbd, Stack, Text } from "@chakra-ui/react";
import { ListRow } from "@pstdio/ui";
import { Search } from "lucide-react";
import { useState } from "react";
import { SEARCH_DEMO_ENTRIES } from "../../content/service-demo-content";
import { useStoryStyles } from "../../hooks/use-landing-styles";

export const SearchDemo = () => {
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState("icons");
  const styles = useStoryStyles();
  const entries = SEARCH_DEMO_ENTRIES.filter((entry) =>
    `${entry.label} ${entry.detail}`.toLowerCase().includes(query.toLowerCase()),
  );
  const activeIndex = Math.max(
    0,
    entries.findIndex((entry) => entry.id === activeId),
  );

  return (
    <Box css={styles.panel}>
      <HStack css={styles.panelHeader}>
        <InputGroup startElement={<Search size={16} />}>
          <Input
            aria-label="Search example tools"
            placeholder="Search tools, files, and commands…"
            value={query}
            variant="borderless"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (entries.length === 0 || !["ArrowDown", "ArrowUp"].includes(event.key)) return;
              event.preventDefault();
              const direction = event.key === "ArrowDown" ? 1 : -1;
              setActiveId(entries[(activeIndex + direction + entries.length) % entries.length].id);
            }}
          />
        </InputGroup>
        <Kbd>⌘ P</Kbd>
      </HStack>
      <Stack css={styles.panelBody} gap="xs" role="group" aria-label="Search results">
        {entries.map((entry, index) => (
          <ListRow
            key={entry.id}
            label={entry.label}
            icon={<entry.icon size={16} />}
            isSelected={activeIndex === index}
            onActivate={() => setActiveId(entry.id)}
            endContent={
              <Text textStyle="label/S/regular" color="fg.muted">
                {entry.detail}
              </Text>
            }
          />
        ))}
        {entries.length === 0 && (
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            No matching tools or commands.
          </Text>
        )}
      </Stack>
    </Box>
  );
};
