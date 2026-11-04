import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import { WorkbenchIcon } from "@pstdio/workbench/react";
import { type ReactNode, useEffect } from "react";
import { settingsPages } from "./settings-fixtures";
import { useSettingsLeaveGuard } from "./settings-leave-warning";

interface SettingsPageProps {
  pageId: string;
  changes?: SettingsActionsProps;
  children: ReactNode;
}

export const SettingsPage = (props: SettingsPageProps) => {
  const { pageId, changes, children } = props;
  const page = settingsPages.find((entry) => entry.id === pageId)!;
  const guard = useSettingsLeaveGuard();
  useEffect(() => {
    if (!changes) return;
    return guard.register({ title: page.title, dirty: changes.dirty, save: changes.onSave, reset: changes.onReset });
  }, [guard, page.title, changes]);
  return (
    <Stack gap="lg" p="lg" maxW="3xl" w="full" minW="0" mx="auto">
      <HStack as="header" justify="space-between" gap="sm" px="sm" flexWrap="wrap">
        <HStack as="h1" gap="sm" textStyle="heading/S">
          <WorkbenchIcon name={page.icon} size="1em" />
          <Text as="span">{page.title}</Text>
        </HStack>
        {changes ? <SettingsActions {...changes} /> : null}
      </HStack>
      {children}
    </Stack>
  );
};

interface SettingsActionsProps {
  dirty: boolean;
  onSave: () => void;
  onReset: () => void;
}

export const SettingsActions = (props: SettingsActionsProps) => (
  <HStack gap="sm">
    <Button size="sm" variant="ghost" disabled={!props.dirty} onClick={props.onReset}>
      Reset changes
    </Button>
    <Button size="sm" variant="primary" disabled={!props.dirty} onClick={props.onSave}>
      Save changes
    </Button>
  </HStack>
);
