import { Badge, HStack, Text } from "@chakra-ui/react";
import { FileQuestion, Lightbulb, ScanSearch, Search } from "lucide-react";
import { useId } from "react";
import { ActionIconButton } from "../../components/list-row/action-icon-button";
import { Sidenav } from "../../components/sidenav/sidenav";
import { chapterGroups, chapters, type Section } from "./book-model";

interface NavigationProps {
  activeSection: Section | null;
  chapter: number;
  unread: Record<Section, number>;
  onSearch: () => void;
  onSection: (section: Section) => void;
  onChapter: (id: number) => void;
}
export function BookNavigation(props: NavigationProps) {
  const { activeSection, chapter, unread, onSearch, onSection, onChapter } = props;
  const id = useId();
  const review = [
    { id: "Findings", label: "Findings", icon: <ScanSearch /> },
    { id: "Undocumented", label: "Undocumented", icon: <FileQuestion /> },
    { id: "Suggestions", label: "Suggestions", icon: <Lightbulb /> },
  ] as const;
  return (
    <Sidenav
      storageKey={`requirement-book-flat-${id}`}
      width="full"
      resizable={false}
      closable={false}
      header={
        <HStack p="md" w="full" justify="space-between">
          <Text textStyle="label/M/medium">Requirement book</Text>
          <ActionIconButton
            tooltip="Search resources (⌘K)"
            aria-label="Search resources"
            size="xs"
            variant="ghost"
            onClick={onSearch}
          >
            <Search />
          </ActionIconButton>
        </HStack>
      }
      activeNodeId={activeSection ?? `chapter-${chapter}`}
      sections={[
        {
          id: "review",
          collapsible: false,
          nodes: review.map((item) => ({
            ...item,
            isNavigable: true,
            endContent:
              unread[item.id] > 0 ? (
                <Badge
                  variant="number"
                  colorPalette="blue"
                  aria-label={`${unread[item.id]} new ${item.label.toLowerCase()}`}
                >
                  {unread[item.id]}
                </Badge>
              ) : undefined,
          })),
        },
        ...chapterGroups.map((group) => ({
          id: group,
          label: group,
          collapsible: false,
          nodes: chapters
            .filter((item) => item.group === group)
            .map((item) => ({
              id: `chapter-${item.id}`,
              label: `RB${item.id} ${item.title}`,
              isNavigable: true,
            })),
        })),
      ]}
      onNavigate={(event) => {
        if (event.nodeId.startsWith("chapter-")) onChapter(Number(event.nodeId.replace("chapter-", "")));
        else onSection(event.nodeId as Section);
      }}
    />
  );
}
