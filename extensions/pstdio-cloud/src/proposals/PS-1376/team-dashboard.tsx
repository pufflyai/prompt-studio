import { CloseButton, HStack, Stack, Text } from "@chakra-ui/react";
import { ResizableSplitLayout, ScrollArea, SimpleCard, SimpleCardBody, TreeList } from "@pstdio/ui";
import { useState } from "react";
import { Button } from "../../button";
import { CloudIcon } from "../../cloud-label";
import { useTeamDemo } from "./demo-model";
import { ManagedExtensions } from "./managed-extensions";
import { JoinTeam, TeamPeople } from "./team-people";

export const TeamDashboard = (props: { viewer?: string }) => {
  const { viewer = "alex" } = props;
  const demo = useTeamDemo(viewer);
  const [page, setPage] = useState("team");
  const [open, setOpen] = useState(true);
  return (
    <Stack h="100dvh" minH="0" p="xl" align="center" justify="center" bg="bg.subtle">
      {!open && (
        <Button variant="outline" onClick={() => setOpen(true)}>
          <CloudIcon name="settings" />
          Settings
        </Button>
      )}
      {open && (
        <SimpleCard maxW="3xl" w="full" h="2xl" maxH="full">
          <SimpleCardBody p="0" h="full" minH="0">
            <Stack h="full" minH="0" gap="0">
              <HStack
                px="md"
                py="sm"
                borderBottomWidth="1px"
                borderColor="border.subtle"
                justify="space-between"
                flexShrink="0"
              >
                <HStack gap="sm">
                  <CloudIcon name="settings" />
                  <Text textStyle="label/M/medium">Settings</Text>
                </HStack>
                <CloseButton size="sm" aria-label="Close settings" onClick={() => setOpen(false)} />
              </HStack>
              <ResizableSplitLayout
                flex="1"
                minH="0"
                minW="0"
                defaultSizePx={200}
                minSizePx={180}
                maxSizePx={280}
                contentMinSizePx={360}
                collapsible={false}
                separator="line"
                resizeLabel="Resize settings navigation"
                resizablePanel={
                  <ScrollArea h="full" bg="bg.subtle">
                    <TreeList
                      sections={[
                        {
                          id: "cloud",
                          label: "Cloud",
                          collapsible: false,
                          nodes: [
                            {
                              id: "team",
                              label: "Team",
                              icon: <CloudIcon name="users" />,
                              onActivate: () => setPage("team"),
                            },
                            {
                              id: "managed",
                              label: "Managed extensions",
                              icon: <CloudIcon name="package-check" />,
                              onActivate: () => setPage("managed"),
                            },
                          ],
                        },
                      ]}
                      activeNodeId={page}
                      expandedSectionIds={["cloud"]}
                      rowVariant="compact"
                      onNavigate={({ nodeId }) => setPage(nodeId)}
                    />
                  </ScrollArea>
                }
                contentPanel={
                  !demo.joined ? (
                    <JoinTeam demo={demo} />
                  ) : (
                    <>
                      {page === "team" && <TeamPeople demo={demo} />}
                      {page === "managed" && <ManagedExtensions demo={demo} />}
                    </>
                  )
                }
              />
            </Stack>
          </SimpleCardBody>
        </SimpleCard>
      )}
    </Stack>
  );
};
