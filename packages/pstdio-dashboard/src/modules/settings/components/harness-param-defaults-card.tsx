import { Box, Button, Card, Flex, HStack, Icon, Menu, Spinner, Stack, Text } from "@chakra-ui/react";
import { ListRow, SearchableMenu, toaster } from "@pstdio/ui";
import { SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { useAgents } from "@/shared/agents/use-agents";
import { HarnessParamEditor } from "../../sessions/components/harness-param-editor";
import type { HarnessParamValues } from "../../sessions/components/harness-param-values";
import {
  useHarnessParamDefaults,
  useUpdateHarnessParamDefaults,
} from "../../sessions/hooks/use-harness-param-defaults";

interface HarnessParamDefaultsCardProps {
  projectId: string;
}

const hasParams = (agent: { params?: unknown }) =>
  Boolean(agent.params && typeof agent.params === "object" && Object.keys(agent.params).length > 0);

export const HarnessParamDefaultsCard = (props: HarnessParamDefaultsCardProps) => {
  const { projectId } = props;
  const { data: agents = [], isLoading } = useAgents(projectId);
  const paramAgents = agents.filter(hasParams);
  const [selectedAgent, setSelectedAgent] = useState("");
  const selectedAgentInfo = paramAgents.find((agent) => agent.id === selectedAgent);
  const defaultsQuery = useHarnessParamDefaults(projectId, selectedAgent || undefined);
  const updateDefaults = useUpdateHarnessParamDefaults(projectId, selectedAgent || undefined);
  const [draft, setDraft] = useState<HarnessParamValues>({});

  useEffect(() => {
    if (selectedAgent || paramAgents.length === 0) return;
    setSelectedAgent(paramAgents[0]!.id);
  }, [paramAgents, selectedAgent]);

  useEffect(() => {
    setDraft(defaultsQuery.data?.defaults ?? {});
  }, [defaultsQuery.data?.defaults]);

  const selectedLabel = selectedAgentInfo?.name ?? "Select harness";
  const isSaveDisabled = !selectedAgent || defaultsQuery.isLoading || updateDefaults.isPending;

  const handleSave = () => {
    if (!selectedAgent) return;
    updateDefaults.mutate(draft, {
      onSuccess: () => toaster.create({ type: "success", title: "Harness defaults saved" }),
      onError: (error) =>
        toaster.create({ type: "error", title: "Failed to save harness defaults", description: error.message }),
    });
  };

  return (
    <Card.Root size="sm" borderRadius="0">
      <Card.Body>
        <HStack gap="4" alignItems="flex-start">
          <Icon boxSize="1em" fontSize="2xl" flexShrink="0" color="fg.muted">
            <SlidersHorizontal />
          </Icon>
          <Stack gap="sm" flex="1" minW="0">
            <Stack gap="1">
              <Card.Title textStyle="sm">Harness run defaults</Card.Title>
              <Card.Description>Project-scoped defaults for harness-specific run parameters.</Card.Description>
            </Stack>

            {isLoading ? (
              <Flex py="sm" justify="center">
                <Spinner size="sm" />
              </Flex>
            ) : paramAgents.length === 0 ? (
              <Text textStyle="paragraph/XS/regular" color="fg.muted">
                No enabled harness declares run parameters.
              </Text>
            ) : (
              <Stack gap="sm">
                <SearchableMenu
                  trigger={
                    <Button size="sm" variant="outline" alignSelf="start">
                      {selectedLabel}
                    </Button>
                  }
                  items={paramAgents.map((agent) => ({
                    id: agent.id,
                    label: agent.name,
                    isSelected: agent.id === selectedAgent,
                    onSelect: () => setSelectedAgent(agent.id),
                  }))}
                  showSearch={paramAgents.length > 5}
                  searchPlaceholder="Search harnesses"
                  portalled
                  emptyState={
                    <Menu.Item value="empty" asChild>
                      <ListRow asChild variant="full-width" id="empty" label="No harnesses found" disabled />
                    </Menu.Item>
                  }
                />

                <Box opacity={defaultsQuery.isLoading ? 0.5 : 1}>
                  <HarnessParamEditor
                    schema={defaultsQuery.data?.schema ?? selectedAgentInfo?.params}
                    defaults={{}}
                    overrides={draft}
                    onOverridesChange={setDraft}
                    disabled={defaultsQuery.isLoading || updateDefaults.isPending}
                  />
                </Box>

                <Button size="sm" alignSelf="start" onClick={handleSave} disabled={isSaveDisabled}>
                  Save defaults
                </Button>
              </Stack>
            )}
          </Stack>
        </HStack>
      </Card.Body>
    </Card.Root>
  );
};
