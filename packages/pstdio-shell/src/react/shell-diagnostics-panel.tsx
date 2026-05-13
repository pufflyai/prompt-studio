import { Box, Button, Flex, Grid, HStack, Text } from "@chakra-ui/react";
import { EmptyState, ScrollArea } from "@pstdio/ui";
import type { RegisteredShellDiagnostic, ShellCore } from "../core";
import { ShellIcon } from "./shell-icons";

interface ShellDiagnosticsPanelProps {
  shell: ShellCore;
  title?: string;
  resourceUri?: string;
  onCommandError?: (error: unknown) => void;
  refresh?: () => void;
}

const severityIconName = (diagnostic: RegisteredShellDiagnostic) => {
  if (diagnostic.severity === "error") return "XCircle";
  if (diagnostic.severity === "warning") return "AlertTriangle";
  return "Info";
};

export const ShellDiagnosticsPanel = (props: ShellDiagnosticsPanelProps) => {
  const { shell, title = "Diagnostics", resourceUri, onCommandError, refresh = () => undefined } = props;
  const diagnostics = shell.diagnostics.listDiagnostics({ resourceUri });

  const runAction = (diagnostic: RegisteredShellDiagnostic, actionIndex: number) => {
    const action = diagnostic.actions?.[actionIndex];
    if (!action) return;

    void shell.commands.executeCommand(action.commandId, action.args).then(refresh).catch(onCommandError);
  };

  return (
    <Flex as="section" direction="column" h="full" w="full" minH="0" minW="0" aria-label={title}>
      <ScrollArea height="100%">
        {diagnostics.length > 0 ? (
          diagnostics.map((diagnostic) => (
            <Grid
              key={diagnostic.id}
              borderBottomWidth="1px"
              borderColor="border.muted"
              gap="xs"
              gridTemplateColumns="1rem minmax(0, 1fr) auto"
              px="sm"
              py="xs"
            >
              <Box aria-hidden="true">
                <ShellIcon name={severityIconName(diagnostic)} />
              </Box>
              <Box minW="0">
                <Text textStyle="paragraph/S/medium" color="fg" overflowWrap="anywhere">
                  {diagnostic.message}
                </Text>
                <Text textStyle="label/XS/regular" color="fg.muted" overflowWrap="anywhere">
                  {[diagnostic.source, diagnostic.code, diagnostic.resource?.label].filter(Boolean).join(" - ")}
                </Text>
              </Box>
              <HStack gap="2xs">
                {diagnostic.actions?.map((action, index) => (
                  <Button
                    key={`${action.commandId}-${index}`}
                    size="xs"
                    variant="subtle"
                    onClick={() => runAction(diagnostic, index)}
                  >
                    {action.title}
                  </Button>
                ))}
              </HStack>
            </Grid>
          ))
        ) : (
          <EmptyState minH="12rem" title="No diagnostics" />
        )}
      </ScrollArea>
    </Flex>
  );
};
