import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useState } from "react";
import { seedCollection } from "@/features/sync/seed-collections";
import { Settings } from "./settings-index";

const seedAgentConfigs = (configs: Array<{ id: string; agent_id: string; is_default: boolean; config?: string }>) => {
  seedCollection(
    "agent_configs",
    configs.map((c) => ({
      id: c.id,
      agent_id: c.agent_id,
      is_default: c.is_default,
      config: c.config ?? "{}",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    })),
  );
};

const SettingsStory = () => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    seedAgentConfigs([
      {
        id: "1",
        agent_id: "claude-code",
        is_default: true,
        config: JSON.stringify({ binary: "/usr/local/bin/claude-code" }),
      },
      {
        id: "2",
        agent_id: "opencode",
        is_default: false,
        config: "{}",
      },
    ]);
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <Box bg="bg" minH="100vh">
      <Settings />
    </Box>
  );
};

const meta: Meta = {
  title: "Settings/SettingsPage",
  parameters: { layout: "fullscreen" },
};

export default meta;

type Story = StoryObj;

export const Default: Story = {
  render: () => <SettingsStory />,
};

const EmptyStory = () => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    seedAgentConfigs([]);
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <Box bg="bg" minH="100vh">
      <Settings />
    </Box>
  );
};

export const Empty: Story = {
  render: () => <EmptyStory />,
};

const MissingBinaryStory = () => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    seedAgentConfigs([{ id: "1", agent_id: "claude-code", is_default: true, config: "{}" }]);
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <Box bg="bg" minH="100vh">
      <Settings />
    </Box>
  );
};

export const MissingBinary: Story = {
  render: () => <MissingBinaryStory />,
};
