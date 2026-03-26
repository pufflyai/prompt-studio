import { Box, IconButton, Input, InputGroup, Menu } from "@chakra-ui/react";
import { Search } from "lucide-react";
import { useState } from "react";
import { MenuItem } from "../menu-item";
import type { SidebarAction } from "./sidebar-tree.types";

interface SearchableActionMenuProps {
  action: SidebarAction;
}

export const SearchableActionMenu = (props: SearchableActionMenuProps) => {
  const { action } = props;
  const [query, setQuery] = useState("");
  const items = action.menuItems ?? [];

  const filtered = query ? items.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())) : items;

  const handleOpenChange = (details: { open: boolean }) => {
    if (!details.open) setQuery("");
  };

  return (
    <Menu.Root onOpenChange={handleOpenChange} onFocusOutside={(e) => e.preventDefault()}>
      <Menu.Trigger asChild>
        <IconButton variant="ghost" size="2xs" aria-label={action.label}>
          {action.icon}
        </IconButton>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content w="260px" bg="bg" p="0">
          <InputGroup startElement={<Search size={14} />}>
            <Input
              borderRight={0}
              borderLeft={0}
              borderTop={0}
              borderRadius="0"
              placeholder="Search hooks…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              autoFocus
            />
          </InputGroup>
          <Box maxH="18rem" overflowY="auto">
            {filtered.length > 0 ? (
              filtered.map((item) => (
                <MenuItem
                  key={item.id}
                  id={item.id}
                  primaryLabel={item.label}
                  variant="compact"
                  onClick={() => item.onAction?.()}
                />
              ))
            ) : (
              <MenuItem primaryLabel="No hooks found" isDisabled variant="compact" />
            )}
          </Box>
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
};
