import type { Meta, StoryObj } from "@storybook/react";
import { MachineTokensPanelView } from "./machine-tokens-panel";

const meta: Meta<typeof MachineTokensPanelView> = {
  title: "ProjectSettings/MachineTokensPanel",
  component: MachineTokensPanelView,
  parameters: { layout: "padded" },
};

export default meta;

type Story = StoryObj<typeof MachineTokensPanelView>;

export const ActiveToken: Story = {
  args: {
    tokens: [
      {
        id: "token-1",
        principalId: "principal-1",
        name: "Notion launcher",
        tokenPrefix: "pst_at_018f",
        projectId: "project-1",
        commandScopes: ["pstdio.planner.command.start-attempt"],
        expiresAt: "2026-09-25T08:00:00.000Z",
        lastUsedAt: "2026-08-26T08:00:00.000Z",
        revokedAt: null,
        createdAt: "2026-08-26T07:00:00.000Z",
      },
    ],
    issuedToken: "pst_at_018f_shown-once",
    name: "",
    scopes: "",
    expiresInDays: "30",
    onNameChange: () => {},
    onScopesChange: () => {},
    onExpiresInDaysChange: () => {},
    onIssue: () => {},
    onRevoke: () => {},
    onCopy: () => {},
  },
};
