import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import { SearchableMenu } from "@pstdio/ui";
import { GitBranch, Search } from "lucide-react";
import type { BookClient } from "./client";
import type { Section } from "./model";
import type { BookData } from "./read";

interface Props {
  data: BookData;
  revision: "working" | "accepted";
  section: Section | null;
  heading: string;
  client: BookClient;
  run: (action: () => Promise<unknown>) => void;
  onRevision: (revision: "working" | "accepted") => void;
  onSearch: () => void;
}
export function BookControls(props: Props) {
  const { data, revision, section, heading, client, run, onRevision, onSearch } = props;
  return (
    <HStack
      px="lg"
      py="md"
      borderBottomWidth="1px"
      borderColor="border.subtle"
      justify="space-between"
      flexShrink="0"
      flexWrap="wrap"
    >
      <Text as="h1" textStyle="label/L/medium">
        {heading}
      </Text>
      <HStack gap="xs" flexWrap="wrap">
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
                  ids: {
                    Findings: data.findings.map((item) => item.id),
                    Undocumented: data.observations.filter((item) => !item.requirements.length).map((item) => item.id),
                    Suggestions: data.suggestions.map((item) => item.id),
                  }[section],
                }),
              )
            }
          >
            Mark all read
          </Button>
        )}
        <SearchableMenu
          trigger={
            <Button size="xs" variant="ghost" aria-label="Book revision">
              <GitBranch />
              {revision === "accepted" ? data.target : data.branch}
            </Button>
          }
          header={
            <Stack p="md" gap="xs">
              <Text textStyle="label/S/medium">One repository book</Text>
              <Text textStyle="paragraph/XS/regular" color="fg.muted">
                Local review and branch edits do not accept intent. Revision {data.head.slice(0, 8)}.
              </Text>
            </Stack>
          }
          items={[
            {
              id: "working",
              label: "Working branch",
              isSelected: revision === "working",
              onSelect: () => onRevision("working"),
            },
            {
              id: "accepted",
              label: "Accepted target branch",
              isSelected: revision === "accepted",
              onSelect: () => onRevision("accepted"),
            },
          ]}
          showSearch={false}
          searchPlaceholder="Book revision"
          emptyState="No revisions"
        />
        <SearchableMenu
          trigger={
            <Button size="xs" variant="ghost" aria-label="Book workspace">
              {data.workspaces.find((item) => item.id === data.workspaceId)?.label ?? "Workspace"}
            </Button>
          }
          items={data.workspaces.map((item) => ({
            id: item.id,
            label: `${item.label}${item.branch ? ` · ${item.branch}` : ""}`,
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
