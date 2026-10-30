import { Box } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { ChatPanel } from "@pstdio/ui/chat-ui";
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
const meta: CanvasMeta<typeof AccessStory> = {
  title: "Sessions/Harness access",
  component: AccessStory,
  args: { installed: true, signedIn: false },
};
export default meta;
type Story = CanvasVariant<typeof AccessStory>;
export const SignedOut: Story = {
  id: "sessions-harness-access--signed-out",
};
export const NoHarness: Story = {
  id: "sessions-harness-access--no-harness",
  args: { installed: false },
};
export const SignedIn: Story = {
  id: "sessions-harness-access--signed-in",
  args: { signedIn: true },
};
export const Narrow: Story = {
  id: "sessions-harness-access--narrow",
  decorators: [
    (Story) => (
      <Box maxW="xs">
        <Story />
      </Box>
    ),
  ],
};
