import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import { type ReactNode, useState } from "react";
import { ScrollArea } from "../primitives/scroll-area";

export interface SettingsChanges {
  dirty: boolean;
  saving?: boolean;
  disabled?: boolean;
  onSave: () => void | Promise<void>;
  onReset: () => void | Promise<void>;
}
export interface SettingsPageProps {
  title: string;
  icon?: ReactNode;
  changes?: SettingsChanges;
  /** Fill the body for views that provide their own scrolling and centered content. */
  contentLayout?: "fill";
  children: ReactNode;
}
export const SettingsActions = (props: SettingsChanges) => {
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const run = async (action: () => void | Promise<void>) => {
    setError(undefined);
    setPending(true);
    try {
      await action();
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setPending(false);
    }
  };
  return (
    <Stack gap="xs" align="end">
      <HStack gap="sm">
        <Button
          size="sm"
          variant="ghost"
          disabled={!props.dirty || props.saving || pending}
          onClick={() => void run(props.onReset)}
        >
          Reset changes
        </Button>
        <Button
          size="sm"
          variant="primary"
          loading={props.saving || pending}
          disabled={!props.dirty || props.disabled || props.saving || pending}
          onClick={() => void run(props.onSave)}
        >
          Save changes
        </Button>
      </HStack>
      {error ? (
        <Text role="alert" color="fg.error" textStyle="paragraph/S/regular">
          {error}
        </Text>
      ) : null}
    </Stack>
  );
};
export const SettingsPage = (props: SettingsPageProps) => (
  <Stack h="full" minH="0" gap="0" minW="0" w="full">
    <HStack as="header" justify="space-between" gap="sm" p="lg" pb="md" maxW="3xl" w="full" mx="auto" flexWrap="wrap">
      <HStack as="h1" gap="sm" textStyle="heading/S">
        {props.icon}
        <Text as="span">{props.title}</Text>
      </HStack>
      {props.changes ? <SettingsActions {...props.changes} /> : null}
    </HStack>
    {props.contentLayout === "fill" ? (
      <Stack flex="1" minH="0" minW="0" gap="0" overflow="hidden">
        {props.children}
      </Stack>
    ) : (
      <ScrollArea flex="1" minH="0" contentProps={{ minH: "full" }}>
        <Stack minH="full" gap="lg" px="lg" pb="lg" maxW="3xl" w="full" minW="0" mx="auto">
          {props.children}
        </Stack>
      </ScrollArea>
    )}
  </Stack>
);
