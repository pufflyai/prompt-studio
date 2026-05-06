import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import { ListRow } from "@pstdio/ui";
import type { Meta, StoryObj } from "@storybook/react";
import { Settings } from "lucide-react";
import { ExtensionWebviewFrame } from "./extension-webview-frame";

const HostStates = () => (
  <Stack gap="lg" width="720px">
    <Stack gap="xs">
      <Text textStyle="label/S/medium">Empty slot</Text>
      <Text textStyle="paragraph/S/regular" color="fg.muted">
        Empty contribution hosts render no controls and preserve surrounding layout.
      </Text>
    </Stack>

    <Stack gap="xs">
      <Text textStyle="label/S/medium">Menu host</Text>
      <HStack gap="xs">
        <Button size="sm" variant="outline">
          Lab: Say hello
        </Button>
        <Button size="sm" variant="ghost">
          Bump lab counter
        </Button>
      </HStack>
    </Stack>

    <Stack gap="xs">
      <Text textStyle="label/S/medium">Navigation host</Text>
      <ListRow variant="compact" id="lab" label="Lab" icon={<Settings size={14} />} />
    </Stack>

    <Stack gap="xs">
      <Text textStyle="label/S/medium">Settings panel host</Text>
      <ListRow variant="compact" id="lab-settings" label="Lab settings" description="Webview-backed settings panel" />
    </Stack>

    <Stack gap="xs" height="240px">
      <Text textStyle="label/S/medium">Webview loading host</Text>
      <ExtensionWebviewFrame
        title="Lab"
        webview={{ entry: { kind: "package-asset", path: "./lab.html", baseUrl: "https://example.invalid/" } }}
      />
    </Stack>
  </Stack>
);

const meta: Meta<typeof HostStates> = {
  title: "Extensions/HostStates",
  component: HostStates,
  parameters: { layout: "padded" },
};

export default meta;

type Story = StoryObj<typeof HostStates>;

export const MenuNavigationSettingsAndWebview: Story = {};
