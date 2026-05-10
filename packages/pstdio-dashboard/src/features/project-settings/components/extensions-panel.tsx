import { Flex, Spinner, Stack, Text } from "@chakra-ui/react";
import { IntegrationCard } from "@pstdio/ui";
import { Puzzle } from "lucide-react";
import type { ExtensionDiagnostic, ExtensionRecord } from "pstdio-api-contracts";
import { useProjectExtensionMetadata } from "@/shared/extensions/hooks/use-project-extensions";

interface ExtensionsPanelProps {
  projectId: string | undefined;
}

interface ExtensionsPanelViewProps {
  extensions: ExtensionRecord[];
  diagnostics: ExtensionDiagnostic[];
}

const severityColor: Record<ExtensionDiagnostic["severity"], string> = {
  error: "fg.error",
  info: "fg.muted",
  warning: "orange.800",
};

export const ExtensionsPanelView = (props: ExtensionsPanelViewProps) => {
  const { extensions, diagnostics } = props;

  return (
    <Stack padding="lg" gap="lg" data-testid="extensions-panel">
      {diagnostics.length > 0 && (
        <Stack gap="sm" data-testid="extension-diagnostics">
          <Text textStyle="label/S" color="fg.muted">
            Diagnostics
          </Text>
          {diagnostics.map((diagnostic, index) => (
            <Stack
              key={`${diagnostic.code}:${diagnostic.message}:${diagnostic.extensionId ?? "project"}:${diagnostic.sourcePath ?? index}`}
              gap="xs"
              borderWidth="1px"
              borderColor="border.muted"
              borderRadius="md"
              padding="md"
              data-testid="extension-diagnostic"
            >
              <Text textStyle="paragraph/S/medium" color={severityColor[diagnostic.severity]}>
                {diagnostic.severity.toUpperCase()}
              </Text>
              <Text textStyle="paragraph/S/regular">{diagnostic.message}</Text>
              {(diagnostic.extensionId || diagnostic.sourcePath) && (
                <Text textStyle="paragraph/XS/regular" color="fg.muted">
                  {[diagnostic.extensionId, diagnostic.sourcePath].filter(Boolean).join(" | ")}
                </Text>
              )}
            </Stack>
          ))}
        </Stack>
      )}

      {extensions.length === 0 && (
        <Text textStyle="paragraph/S/regular" color="fg.muted" data-testid="extensions-empty">
          No extensions installed or enabled.
        </Text>
      )}

      {extensions.map((extension) => (
        <Stack key={extension.id} data-testid="extension-entry">
          <IntegrationCard
            icon={<Puzzle />}
            name={extension.displayName}
            version={extension.version}
            description={extension.description ?? "No description provided."}
            id={extension.id}
            metadata={[
              { label: "Namespace", value: extension.namespace },
              { label: "Source", value: extension.sourcePath },
            ]}
            active
          />
        </Stack>
      ))}
    </Stack>
  );
};

export const ExtensionsPanel = (props: ExtensionsPanelProps) => {
  const { projectId } = props;
  const { data, isLoading, error } = useProjectExtensionMetadata(projectId);

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
          {error instanceof Error ? error.message : "Failed to load extensions."}
        </Text>
      </Stack>
    );
  }

  return <ExtensionsPanelView extensions={data?.extensions ?? []} diagnostics={data?.diagnostics ?? []} />;
};
