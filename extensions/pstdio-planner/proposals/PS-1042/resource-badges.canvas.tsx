import { Box, Stack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { CollectionBadge, KanbanRendererCard } from "@pstdio/ui/kanban-renderer";
import { useState } from "react";

interface LinkedResource {
  id: string;
  label: string;
  icon: string;
  description: string;
  unavailable?: boolean;
}

const workspace: LinkedResource = {
  id: "workspace-attempt",
  label: "PS-1042_A1",
  icon: "folder",
  description: "Workspace · PS-1042_A1",
};
const pullRequest: LinkedResource = {
  id: "github-pr-1602",
  label: "prompt-studio #1602",
  icon: "git-pull-request",
  description: "GitHub · pufflyai/prompt-studio #1602 · Add reusable PR resources",
};
const artifact: LinkedResource = {
  id: "artifact-design",
  label: "Interaction prototype",
  icon: "file-code",
  description: "Artifacts · Interaction prototype",
};

function TicketResourceBadges(props: { resources: LinkedResource[] }) {
  const { resources } = props;
  const [opened, setOpened] = useState<string | null>(null);
  return (
    <Box maxW="sm">
      <Stack gap="md">
        <KanbanRendererCard
          eyebrow="PS-1042"
          title="Add GitHub PR resources and replace Planner pull request links"
          badges={[{ attributeId: "type", label: "Feature", color: "green" }]}
          onClick={() => setOpened("PS-1042 · Ticket")}
          customSlots={resources.map((resource) => (
            <CollectionBadge
              key={resource.id}
              label={resource.label}
              icon={resource.unavailable ? "circle-alert" : resource.icon}
              tooltip={resource.unavailable ? `${resource.description} · Unavailable` : resource.description}
              onClick={resource.unavailable ? undefined : () => setOpened(resource.description)}
            />
          ))}
        />
        {opened ? (
          <Text role="status" textStyle="label/S/regular" color="fg.muted">
            Opened: {opened}
          </Text>
        ) : null}
      </Stack>
    </Box>
  );
}

export default {
  title: "Proposals/PS-1042 Linked resource badges",
  description: "One linked-resource badge list for workspaces, PRs, and artifacts. Sample data only.",
} satisfies CanvasMeta;

export const PullRequestAndWorkspace: CanvasFrame = {
  render: () => <TicketResourceBadges resources={[workspace, pullRequest]} />,
};
export const MultipleResourceKinds: CanvasFrame = {
  render: () => <TicketResourceBadges resources={[workspace, pullRequest, artifact]} />,
};
export const NoLinkedResources: CanvasFrame = {
  render: () => <TicketResourceBadges resources={[]} />,
};
export const UnavailableResource: CanvasFrame = {
  render: () => <TicketResourceBadges resources={[workspace, { ...pullRequest, unavailable: true }]} />,
};
