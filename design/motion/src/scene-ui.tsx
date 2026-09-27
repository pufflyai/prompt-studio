import { Box, Button, Flex, HStack, Input, Spinner, Stack, Text } from "@chakra-ui/react";
import { Header, ListRow } from "@pstdio/ui";
import { ChatInput, ChatMessage, ChatWorkspaceHub, createSerializedPromptState } from "@pstdio/ui/chat-ui";
import { ArrowUpRight, ChevronDown, FileText, Folder, GitBranch, PanelRight, Plus } from "lucide-react";
import type { ReactNode } from "react";
import type { SceneProps } from "./model";
import { duration, track } from "./motion";
import { loaderCycleSeconds, timings } from "./presets";
import { WorkingTreatment } from "./working-treatment";

export const SceneWindow = (props: { children: ReactNode; title?: string; sidebar?: boolean; header?: boolean }) => {
  const { children, title = "Motion studies", sidebar = false, header = true } = props;
  return (
    <Flex
      h="full"
      minH="0"
      bg="bg"
      color="fg"
      borderWidth="1px"
      borderColor="border"
      borderRadius="xs"
      overflow="hidden"
    >
      {sidebar && (
        <Stack w="48" flexShrink="0" bg="bg.subtle" borderRightWidth="1px" borderColor="border" gap="0">
          <Header>
            <Text textStyle="label/S/medium">Prompt Studio</Text>
          </Header>
          <Stack p="xs" gap="xs">
            {["Sessions", "Workspaces", "Files"].map((label) => (
              <ListRow key={label} label={label} variant="compact" icon={<Folder size={14} />} />
            ))}
            <Text px="xs" pt="md" textStyle="label/XS/regular" color="fg.muted">
              Tools
            </Text>
            <ListRow label="Motion Lab" variant="compact" />
          </Stack>
        </Stack>
      )}
      <Flex direction="column" flex="1" minW="0" minH="0">
        {header && (
          <Header borderBottomWidth="1px" borderColor="border">
            <Text textStyle="label/S/medium">{title}</Text>
            <Box flex="1" />
            <PanelRight size={14} />
          </Header>
        )}
        <Box flex="1" minW="0" minH="0" overflow="hidden" position="relative">
          {children}
        </Box>
      </Flex>
    </Flex>
  );
};
export const Message = (props: { children: ReactNode; user?: boolean }) => {
  const { children, user = false } = props;
  return (
    <ChatMessage.Root from={user ? "user" : "assistant"}>
      <ChatMessage.Content from={user ? "user" : "assistant"}>
        <Text textStyle="paragraph/S/regular">{children}</Text>
      </ChatMessage.Content>
    </ChatMessage.Root>
  );
};
export const Composer = (props: { working?: boolean; text?: string; queue?: ReactNode; hasQueue?: boolean }) => {
  const { working = false, text = "Ask a follow-up…", queue, hasQueue = false } = props;
  return (
    <Stack px="2xs" pb="2xs" gap="2xs" flexShrink="0">
      <Stack gap="2xs" p="2xs" borderWidth="1px" borderColor="border" borderRadius="sm" bg="bg.subtle">
        <ChatWorkspaceHub
          additions={24}
          deletions={3}
          workspaceControl={
            <HStack gap="xs">
              <GitBranch size={14} />
              <Text textStyle="label/XS/regular">motion-studies</Text>
              <ChevronDown size={12} />
            </HStack>
          }
          action={<ArrowUpRight size={14} />}
        />
        {queue}
        <ChatInput
          attachedToTop={hasQueue}
          defaultState={createSerializedPromptState("")}
          placeholder={text}
          streaming={working}
          onInterrupt={() => {}}
          autoFocus={false}
          recessed
          actions={
            <HStack gap="xs" color="fg.muted">
              <Plus size={14} />
              <Text textStyle="label/XS/regular">Codex</Text>
              <ChevronDown size={12} />
            </HStack>
          }
        />
      </Stack>
    </Stack>
  );
};
export const Activity = (props: SceneProps & { start: number; end: number; elapsedFrom?: number; label?: string }) => {
  const { time, start, end, elapsedFrom = start, label = "", variant, reducedMotion } = props;
  const visibility = track(time, [
    { at: start, value: 1, duration: duration(props, timings.loader) },
    { at: end, value: 0, duration: duration(props, timings.loader) },
  ]);
  const elapsed = Math.max(0, Math.floor(Math.min(time, end) - elapsedFrom));
  const still = reducedMotion;
  const opacity = still ? 1 : 0.45 + (0.55 * (1 - Math.cos(((time - start) / loaderCycleSeconds) * Math.PI * 2))) / 2;
  return (
    <HStack h="16" px="sm" align="end" pb="xs" position="relative" gap="2xs" opacity={visibility} color="fg.muted">
      <WorkingTreatment {...props} />
      <Box position="relative" w="4" h="4" display="flex" alignItems="center" justifyContent="center">
        {variant.loader === "spinner" ? (
          <Box transform={`rotate(${still ? 0 : (time - start) * 720}deg)`}>
            <Spinner size="xs" color="fg.muted" />
          </Box>
        ) : (
          <Box
            w="2"
            h="2"
            my="1"
            bg="fg.muted"
            borderRadius="full"
            opacity={variant.loader === "pulse" ? opacity : 1}
          />
        )}
      </Box>
      <Text
        position="relative"
        textStyle="label/XS/regular"
        fontFamily="mono"
        fontVariantNumeric="tabular-nums"
        minW="12"
      >
        {elapsed}s
      </Text>
      <Text textStyle="label/S/regular">{label}</Text>
    </HStack>
  );
};
export const FileRow = (props: { name: string; folder?: boolean }) => {
  const { name, folder = false } = props;
  return <ListRow variant="tree" label={name} icon={folder ? <Folder size={16} /> : <FileText size={16} />} />;
};
export const FolderInput = (props: { value: string }) => {
  const { value } = props;
  return (
    <HStack gap="sm">
      <Input size="sm" readOnly value={value} placeholder="New folder name" />
      <Button size="sm" variant="primary" disabled={!value.trim()}>
        <Plus size={16} />
        Create folder
      </Button>
    </HStack>
  );
};
