import { Button, HStack, Text } from "@chakra-ui/react";
import { SearchableMenu } from "@pstdio/ui";
import { Search } from "lucide-react";
import type { BookClient } from "./client";
import type { Section } from "./model";
import type { BookData } from "./read";

interface Props {
  data: BookData;
  section: Section | null;
  heading: string;
  client: BookClient;
  run: (action: () => Promise<unknown>) => void;
  onSearch: () => void;
}
export function BookControls(props: Props) {
  const { data, section, heading, client, run, onSearch } = props;
  return (
    <HStack px="md" py="xs" gap="sm" minW="0" borderBottomWidth="1px" borderColor="border.subtle" flexShrink="0">
      <Text as="h1" textStyle="label/M/medium" minW="0" flex="1" truncate title={heading}>
        {heading}
      </Text>
      <HStack gap="xs" minW="0">
        <Button size="xs" variant="ghost" aria-label="Search requirements" onClick={onSearch}>
          <Search />
        </Button>
        {section && data.counts[section] > 0 && (
          <Button
            size="xs"
            variant="ghost"
            onClick={() =>
              run(() =>
                client.commands["review.mark-read"]({
                  workspaceId: data.workspaceId,
                  ids:
                    section === "Findings"
                      ? data.findings.map((item) => item.id)
                      : data.suggestions.map((item) => item.id),
                }),
              )
            }
          >
            Mark all read
          </Button>
        )}
        <SearchableMenu
          lazyMount
          trigger={
            <Button size="xs" variant="ghost" aria-label="Book workspace" maxW="160px" minW="0">
              <Text as="span" truncate>
                {data.workspaces.find((item) => item.id === data.workspaceId)?.label ?? "Workspace"}
              </Text>
            </Button>
          }
          items={data.workspaces.map((item) => ({
            id: item.id,
            label: item.label,
            isSelected: item.id === data.workspaceId,
            onSelect: () => run(() => client.commands["workspace.select"]({ workspaceId: item.id })),
          }))}
          searchPlaceholder="Find a workspace…"
          emptyState="No local workspaces"
        />
      </HStack>
    </HStack>
  );
}
