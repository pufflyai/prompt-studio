import { Flex, Spinner, Stack, Text } from "@chakra-ui/react";
import { Puzzle } from "lucide-react";
import { useProjectPlugins } from "../hooks/use-plugins";

interface PluginsPanelProps {
  projectId: string | undefined;
}

export const PluginsPanel = (props: PluginsPanelProps) => {
  const { projectId } = props;
  const { data, isLoading, error } = useProjectPlugins(projectId);

  if (isLoading) {
    return (
      <Flex flex="1" justifyContent="center" alignItems="center" padding="lg">
        <Spinner />
      </Flex>
    );
  }

  if (error) {
    return (
      <Stack padding="lg" gap="lg">
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          {error instanceof Error ? error.message : "Failed to load plugins."}
        </Text>
      </Stack>
    );
  }

  const plugins = data?.plugins ?? [];
  const pluginsDir = data?.pluginsDir ?? null;

  return (
    <Stack padding="lg" gap="md" data-testid="plugins-panel">
      {pluginsDir && (
        <Stack gap="xs">
          <Text textStyle="label/S" color="fg.muted">
            Plugin folder
          </Text>
          <Text textStyle="paragraph/XS/regular" color="fg.muted" data-testid="plugins-dir">
            {pluginsDir}
          </Text>
        </Stack>
      )}

      {plugins.length === 0 && (
        <Text textStyle="paragraph/S/regular" color="fg.muted" data-testid="plugins-empty">
          No plugins registered.
        </Text>
      )}

      {plugins.map((plugin) => (
        <Flex
          key={plugin.identity}
          alignItems="center"
          gap="md"
          borderWidth="1px"
          borderColor="border.muted"
          borderRadius="md"
          padding="md"
          data-testid="plugin-entry"
        >
          <Puzzle size={16} />
          <Stack flex="1" gap="xs">
            <Flex alignItems="center" gap="sm">
              <Text textStyle="paragraph/S/medium">{plugin.identity}</Text>
            </Flex>
            <Text textStyle="paragraph/XS/regular" color="fg.muted">
              {plugin.filePath}
            </Text>
          </Stack>
        </Flex>
      ))}
    </Stack>
  );
};
