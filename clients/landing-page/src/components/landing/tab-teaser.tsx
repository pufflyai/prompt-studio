import { Box, Stack } from "@chakra-ui/react";
import { EmptyState } from "@pstdio/ui";
import { INSTALL_COMMANDS, PROJECT_TABS, type ProjectTabId } from "./landing-content";
import { TerminalBlock } from "./terminal-block";

interface TabTeaserProps {
  tabId: ProjectTabId;
}

export const TabTeaser = (props: TabTeaserProps) => {
  const { tabId } = props;

  const tab = PROJECT_TABS.find((candidate) => candidate.id === tabId);
  const Icon = tab?.icon;
  const tabLabel = tab?.label ?? "This workflow";

  return (
    <Stack align="center" justify="center" height="100%" gap="8" px="20px">
      <EmptyState
        icon={Icon ? <Icon size={28} /> : undefined}
        title={`${tabLabel} isn't installed — yet.`}
        description="Tabs like this aren't features you wait for. In Prompt Studio your agent builds them from a prompt, right into the workbench."
      />
      <Box width="100%" maxWidth="420px">
        <TerminalBlock commands={INSTALL_COMMANDS} />
      </Box>
    </Stack>
  );
};
