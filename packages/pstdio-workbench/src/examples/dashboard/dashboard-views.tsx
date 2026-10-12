import { Box, Button, HStack, Input, Stack, Text } from "@chakra-ui/react";
import { ListRow } from "@pstdio/ui";
import { ChatPanel } from "@pstdio/ui/chat-ui";
import { useState } from "react";
import type { ResourceRef } from "../../core";
import { WorkbenchIcon } from "../../react";
import { useShowcaseStore } from "../showcases/showcase-store";
import { type DashboardData, dashboardWorkspaces } from "./dashboard-data";

export const DashboardConversation = (props: { resource: ResourceRef; data: DashboardData }) => {
  const { resource, data } = props;
  const state = useShowcaseStore(data.conversations);
  const [draft, setDraft] = useState("");
  return (
    <Stack h="full" minH="0" gap="0">
      <HStack px="md" py="sm" borderBottomWidth="1px" borderColor="border.subtle">
        <WorkbenchIcon name="MessagesSquare" />
        <Text textStyle="paragraph/S/semibold">{String(resource.metadata?.workspaceLabel)}</Text>
      </HStack>
      <Box flex="1" minH="0">
        <ChatPanel
          conversationKey={resource.id}
          messages={state.messages[resource.id]}
          emptyStateTitle="Start a conversation"
          emptyStateDescription="Try sending a sample message."
          chatInputPlaceholder="Send a sample message…"
          chatInputDefaultValue={draft}
          onChatInputChange={setDraft}
          onSubmitMessage={(text) => {
            data.conversations.setState((current) => ({
              messages: {
                ...current.messages,
                [resource.id]: [
                  ...current.messages[resource.id],
                  { id: crypto.randomUUID(), role: "user", parts: [{ type: "text", text }] },
                  {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    parts: [
                      {
                        type: "text",
                        text: `Sample reply: your message is saved in the ${resource.metadata?.workspaceLabel} conversation. Try moving this tab or switching workspaces; the conversation stays with its tab.`,
                      },
                    ],
                  },
                ],
              },
            }));
            setDraft("");
          }}
        />
      </Box>
    </Stack>
  );
};

export const DashboardTerminal = (props: { resource: ResourceRef }) => {
  const { resource } = props;
  const [command, setCommand] = useState("");
  const [lines, setLines] = useState([`Sample shell · ${resource.label}`, "$ pwd", `/projects/${resource.id}`]);
  const submit = () => {
    const input = command.trim();
    if (!input) return;
    const outputs: Record<string, string> = {
      pwd: `/projects/${resource.id}`,
      ls: "README.md   src/   package.json",
      help: "Sample commands: pwd, ls, clear, help. Commands run only inside this demo.",
    };
    setLines(input === "clear" ? [] : [...lines, `$ ${input}`, outputs[input] ?? "Try pwd, ls, clear, or help."]);
    setCommand("");
  };
  return (
    <Stack h="full" p="sm" gap="sm">
      <Box flex="1" minH="0" overflowY="auto">
        <Text
          as="pre"
          fontFamily="mono"
          textStyle="paragraph/S/regular"
          whiteSpace="pre-wrap"
          aria-label="Terminal output"
          role="log"
        >
          {lines.join("\n")}
        </Text>
      </Box>
      <HStack asChild>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Text color="fg.muted">$</Text>
          <Input
            size="xs"
            aria-label="Terminal command"
            placeholder="Try ls or help"
            value={command}
            onChange={(event) => setCommand(event.target.value)}
          />
          <Button size="xs" variant="outline" type="submit">
            Run
          </Button>
        </form>
      </HStack>
    </Stack>
  );
};

export const DashboardChanges = (props: { resource: ResourceRef }) => {
  const { resource } = props;
  return (
    <Stack p="lg" gap="md">
      <Text textStyle="heading/S/semibold">Changes in {resource.label}</Text>
      <Text color="fg.muted" textStyle="paragraph/S/regular">
        Sample changes ready to review.
      </Text>
      <ListRow
        label="src/app.ts"
        icon={<WorkbenchIcon name="FileCode" />}
        description="Updated the project greeting"
        endContent={<Text color="fg.success">+4 −1</Text>}
      />
      <Text
        as="pre"
        fontFamily="mono"
        textStyle="paragraph/S/regular"
        whiteSpace="pre-wrap"
        p="md"
        bg="bg.subtle"
        borderRadius="md"
      >
        {`export function greeting(name: string) {\n  return \`Hello, \${name}!\`;\n}`}
      </Text>
    </Stack>
  );
};

export const DashboardWorkspaceList = (props: { openWorkspace(resource: ResourceRef): void }) => {
  const { openWorkspace } = props;
  return (
    <Stack p="lg" gap="md">
      <Text textStyle="heading/M/semibold">Workspaces</Text>
      {dashboardWorkspaces.map((resource) => (
        <ListRow
          key={resource.id}
          label={resource.label}
          icon={<WorkbenchIcon name="Folder" />}
          isNavigable
          onActivate={() => openWorkspace(resource)}
        />
      ))}
    </Stack>
  );
};
