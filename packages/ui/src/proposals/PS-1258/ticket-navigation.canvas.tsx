import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { FileText, Folder, GitPullRequest, MessageCircle, MessageCircleWarning, Ticket } from "lucide-react";
import { useState } from "react";
import { Activity } from "../../components/activity";
import { ScrollArea } from "../../components/primitives/scroll-area";
import { TreeList } from "../../components/tree-list/tree-list";
import type { TreeListSection } from "../../components/tree-list/tree-list.types";

export default {
  title: "Proposals/PS-1258 Ticket resource groups and ticket-only activity",
  fullscreen: true,
  description:
    "PS-1258 and PS-1259. Open the ticket, its file, Needs attention, and the related resources. All records are synthetic and comments stay local.",
};

export const TicketNavigation = () => {
  const [selected, setSelected] = useState("ticket");
  const [draft, setDraft] = useState("");
  const [comments, setComments] = useState(["The release checks are ready for review."]);
  const [answered, setAnswered] = useState(false);
  const [expanded, setExpanded] = useState(["files", "workspaces", "sessions", "pull-requests", "notes"]);
  const ticketOpen = selected === "ticket" || selected === "attention";
  const sections: TreeListSection[] = [
    {
      id: "ticket",
      collapsible: false,
      nodes: [
        { id: "ticket", label: "PS-1232 Complete release checks", icon: <Ticket /> },
        ...(ticketOpen && !answered
          ? [{ id: "attention", label: "Needs attention", icon: <MessageCircleWarning /> }]
          : []),
      ],
    },
    { id: "files", label: "Files", nodes: [{ id: "file", label: "release-first-summary.json", icon: <FileText /> }] },
    { id: "workspaces", label: "Workspaces", nodes: [{ id: "workspace", label: "WS-380", icon: <Folder /> }] },
    {
      id: "sessions",
      label: "Sessions",
      nodes: [{ id: "session", label: "Check release failures", icon: <MessageCircle /> }],
    },
    {
      id: "pull-requests",
      label: "Pull requests",
      nodes: [{ id: "pr", label: "prompt-studio #2111", icon: <GitPullRequest /> }],
    },
    { id: "notes", label: "Notes", nodes: [{ id: "note", label: "Release checklist", icon: <FileText /> }] },
  ];
  const titles: Record<string, string> = {
    ticket: "PS-1232 Complete release checks",
    attention: "PS-1232 · Needs attention",
    file: "release-first-summary.json",
    workspace: "WS-380",
    session: "Check release failures",
    pr: "prompt-studio #2111",
    note: "Release checklist",
  };
  return (
    <HStack align="stretch" h="full" minH="0" gap="0" bg="bg" color="fg">
      <Stack w="xs" minH="0" flexShrink="0" borderRightWidth="1px" borderColor="border" gap="0">
        <Box p="sm">
          <Button variant="ghost" onClick={() => setSelected("ticket")}>
            Back to ticket
          </Button>
        </Box>
        <ScrollArea flex="1" minH="0">
          <TreeList
            sections={sections}
            rowVariant="compact"
            activeNodeId={selected}
            expandedSectionIds={expanded}
            onToggleSection={(id) =>
              setExpanded((current) =>
                current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
              )
            }
            onNavigate={({ nodeId }) => setSelected(nodeId)}
          />
        </ScrollArea>
      </Stack>
      <Stack flex="1" minW="0" minH="0" gap="0">
        <Box p="md" borderBottomWidth="1px" borderColor="border">
          <Text textStyle="heading.sm">{titles[selected]}</Text>
        </Box>
        <ScrollArea flex="1" minH="0" contentProps={{ p: "md" }}>
          <Stack gap="lg">
            {selected === "ticket" && <Text>Complete the release checks and preserve the known failures.</Text>}
            {selected === "file" && <Text as="pre">{'{\n  "checks": "complete",\n  "knownFailures": 2\n}'}</Text>}
            {selected === "attention" && (
              <Stack gap="sm">
                <Text>{answered ? "No items need attention" : "Approve the release checklist"}</Text>
                {!answered && (
                  <Button alignSelf="start" onClick={() => setAnswered(true)}>
                    Approve
                  </Button>
                )}
              </Stack>
            )}
            {!ticketOpen && selected !== "file" && <Text>{titles[selected]}</Text>}
            {selected === "ticket" && (
              <Activity.Root aria-label="Ticket activity">
                <Activity.Header />
                <Activity.Feed>
                  {comments.map((comment, index) => (
                    <Activity.Comment key={index} actor={{ name: "Jordan Lee" }} timestamp="Just now">
                      {comment}
                    </Activity.Comment>
                  ))}
                </Activity.Feed>
                <Activity.Composer
                  variant="compact"
                  value={draft}
                  onChange={setDraft}
                  onSubmit={() => {
                    if (draft.trim()) {
                      setComments((current) => [...current, draft]);
                      setDraft("");
                    }
                  }}
                />
              </Activity.Root>
            )}
          </Stack>
        </ScrollArea>
      </Stack>
    </HStack>
  );
};
