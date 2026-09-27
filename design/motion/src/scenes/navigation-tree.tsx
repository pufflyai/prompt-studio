import { Box, Stack, Text } from "@chakra-ui/react";
import { Header, ListRow, TreeList } from "@pstdio/ui";
import { Files, Folder, MessageCircle, MoreHorizontal, MousePointer2, Search, Ticket } from "lucide-react";
import type { SceneProps } from "../model";
import { duration, track } from "../motion";
import { timings } from "../presets";
import { PanelSurface } from "../workbench-frame";

export const NavigationTree = (props: SceneProps) => {
  const { time } = props;
  const expansion = track(time, [
    { at: 1, value: 1, duration: duration(props, timings.treeExpand, true) },
    { at: 5, value: 0, duration: duration(props, timings.treeCollapse, true) },
    { at: 6, value: 1, duration: duration(props, timings.treeExpand, true) },
    { at: 6.08, value: 0, duration: duration(props, timings.treeCollapse, true) },
    { at: 7, value: 1, duration: duration(props, timings.treeExpand, true) },
  ]);
  const nested = track(time, [
    { at: 2, value: 1, duration: duration(props, timings.treeExpand, true) },
    { at: 8, value: 0, duration: duration(props, timings.treeCollapse, true) },
  ]);
  // Hover exits wait 150 ms; returning inside that window keeps actions visible.
  const hovered = time >= 3.5 && time < 4.65;
  return (
    <PanelSurface>
      <Stack h="full" bg="bg.subtle" gap="0" position="relative">
        <Header px="compact">
          <Text textStyle="label/S/medium">Prompt Studio</Text>
        </Header>
        <Stack px="compact" gap="0">
          <Box h="128px" flexShrink="0">
            <TreeList
              virtualize={false}
              rowVariant="compact"
              activeNodeId={time < 3 ? "workspaces" : undefined}
              sections={[
                {
                  id: "nav",
                  nodes: [
                    { id: "search", label: "Search", icon: <Search /> },
                    { id: "sessions", label: "Sessions", icon: <MessageCircle /> },
                    { id: "workspaces", label: "Workspaces", icon: <Files /> },
                    { id: "tickets", label: "Tickets", icon: <Ticket /> },
                  ],
                },
              ]}
            />
          </Box>
          <Box
            h="44px"
            flexShrink="0"
            css={{ "& .lucide-chevron-right": { transform: `rotate(${expansion * 90}deg) !important` } }}
          >
            <TreeList
              virtualize={false}
              sections={[{ id: "workspaces", label: "Workspaces", collapsible: true, nodes: [] }]}
            />
          </Box>
          <Box h={`${expansion * (84 + nested * 72)}px`} overflow="hidden" flexShrink="0" px="xs">
            <ListRow
              variant="tree"
              label="motion-studies"
              icon={<Folder />}
              isContainer
              showExpandToggle
              isExpanded={nested > 0}
              css={{ "& .lucide-chevron-right": { transform: `rotate(${nested * 90}deg)` } }}
            />
            <Box h={`${nested * 72}px`} overflow="hidden">
              <Box pl="2xs" h="72px">
                <TreeList
                  virtualize={false}
                  activeNodeId={time >= 3 ? "review" : undefined}
                  sections={[
                    {
                      id: "recent",
                      nodes: [
                        {
                          id: "review",
                          label: "Review panel motion",
                          icon: <MessageCircle />,
                          endContent: (
                            <Box opacity={hovered ? 1 : 0}>
                              <MoreHorizontal size={14} />
                            </Box>
                          ),
                        },
                        { id: "streaming", label: "Streaming text", icon: <MessageCircle /> },
                      ],
                    },
                  ]}
                />
              </Box>
            </Box>
            <ListRow variant="tree" label="website" icon={<Folder />} isContainer showExpandToggle />
            <ListRow variant="tree" label="design-system" icon={<Folder />} isContainer showExpandToggle />
          </Box>
          <Box h="100px" flexShrink="0">
            <TreeList
              virtualize={false}
              expandedSectionIds={["tools"]}
              sections={[
                {
                  id: "tools",
                  label: "Tools",
                  collapsible: true,
                  nodes: [
                    { id: "lab", label: "Motion Lab", icon: <Files /> },
                    { id: "kiln", label: "Kiln", icon: <Files /> },
                  ],
                },
              ]}
            />
          </Box>
        </Stack>
        {time >= 3.5 && time < 5 && (
          <Box
            position="absolute"
            left={time < 4 || (time >= 4.1 && time < 4.5) ? "212px" : "228px"}
            top={time < 4 || (time >= 4.1 && time < 4.5) ? "255px" : "310px"}
          >
            <MousePointer2 size={16} />
          </Box>
        )}
      </Stack>
    </PanelSurface>
  );
};
