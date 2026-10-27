import { Box } from "@chakra-ui/react";
import { ChatPanel } from "@pstdio/ui/chat-ui";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { SessionHarnessSignIn } from "./session-harness-sign-in";
import { SessionHarnessUnavailable } from "./session-harness-unavailable";

const AccessStory = (props: { installed: boolean; signedIn: boolean }) => {
  const [text, setText] = useState("");
  const { installed, signedIn } = props;
  let setup: import("react").ReactNode;
  if (!installed) setup = <SessionHarnessUnavailable onReviewExtensions={() => {}} />;
  else if (!signedIn) setup = <SessionHarnessSignIn name="Codex" onLogin={() => {}} />;
  return (
    <Box h="xl">
      <ChatPanel
        messages={[]}
        emptyStateTitle="No messages yet"
        emptyStateDescription="Send a message to start this session."
        emptyStateContent={setup}
        hideComposer={!installed}
        chatInputPlaceholder="Reply to the agent..."
        chatInputDefaultValue={text}
        onChatInputChange={setText}
        chatInputCommands={[
          { name: "/login", description: "Sign in", onSelect: () => {} },
          { name: "/logout", description: "Sign out", onSelect: () => {} },
        ]}
        submitDisabled={!signedIn && !/^\/(login|logout)$/.test(text)}
        onSubmitMessage={() => setText("")}
      />
    </Box>
  );
};
const meta: Meta<typeof AccessStory> = {
  title: "Sessions/Harness access",
  component: AccessStory,
  args: { installed: true, signedIn: false },
};
export default meta;
type Story = StoryObj<typeof AccessStory>;
export const SignedOut: Story = {};
export const NoHarness: Story = { args: { installed: false } };
export const SignedIn: Story = { args: { signedIn: true } };
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <Box maxW="xs">
        <Story />
      </Box>
    ),
  ],
};
