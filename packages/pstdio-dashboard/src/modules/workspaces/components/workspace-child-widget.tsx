import { Box, Icon, Stack } from "@chakra-ui/react";
import { EmptyState, ListRow } from "@pstdio/ui";
import type { ResourceRef } from "@pstdio/workbench/core";
import { File, Folder, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { subscribeDashboardData } from "@/shared/sync/dashboard-rows";
import { createDashboardSessions } from "../../sessions/data/dashboard-sessions";

interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

interface DirectoryListResponse {
  entries: DirectoryEntry[];
}

const metadataString = (resource: ResourceRef, key: string) => {
  const value = resource.metadata?.[key];
  return typeof value === "string" ? value : undefined;
};

const readWorkspaceSessions = (projectId: string | undefined, workspaceId: string | undefined) =>
  createDashboardSessions(projectId).filter((session) => session.workspaceId === workspaceId);

const useWorkspaceFiles = (resource: ResourceRef) => {
  const workspacePath = metadataString(resource, "workspacePath");
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(Boolean(workspacePath));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!workspacePath) return;
    let disposed = false;
    setLoading(true);
    setFailed(false);

    void apiRequest<DirectoryListResponse>(`/v1/filesystem/list?path=${encodeURIComponent(workspacePath)}`)
      .then((response) => {
        if (!disposed) setEntries(response.entries);
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });

    return () => {
      disposed = true;
    };
  }, [workspacePath]);

  return { entries, failed, loading };
};

const WorkspaceFilesWidget = (props: { resource: ResourceRef }) => {
  const { resource } = props;
  const { entries, failed, loading } = useWorkspaceFiles(resource);

  if (loading) return <EmptyState title="Loading workspace files" height="full" />;
  if (failed) return <EmptyState title="Unable to load workspace files" height="full" />;
  if (entries.length === 0) return <EmptyState title="No workspace files" height="full" />;

  return (
    <Stack p="xs" gap="1px" role="list" aria-label="Workspace files">
      {entries.map((entry) => (
        <ListRow
          key={entry.path}
          id={entry.path}
          label={entry.name}
          icon={<Icon as={entry.isDirectory ? Folder : File} boxSize="14px" />}
          variant="compact"
        />
      ))}
    </Stack>
  );
};

const WorkspaceSessionsWidget = (props: { resource: ResourceRef; onOpenSession: (resource: ResourceRef) => void }) => {
  const { resource, onOpenSession } = props;
  const projectId = metadataString(resource, "projectId");
  const workspaceId = metadataString(resource, "workspaceId");
  const [sessions, setSessions] = useState(() => readWorkspaceSessions(projectId, workspaceId));

  useEffect(() => {
    const refresh = () => setSessions(readWorkspaceSessions(projectId, workspaceId));
    refresh();
    return subscribeDashboardData(refresh);
  }, [projectId, workspaceId]);

  if (sessions.length === 0) return <EmptyState title="No workspace sessions" height="full" />;

  return (
    <Stack p="xs" gap="1px" role="list" aria-label="Workspace sessions">
      {sessions.map((session) => (
        <ListRow
          key={session.resource.uri}
          id={session.resource.uri}
          label={session.title}
          description={session.status}
          icon={<Icon as={MessageCircle} boxSize="14px" />}
          variant="compact"
          onActivate={() => onOpenSession(session.resource)}
        />
      ))}
    </Stack>
  );
};

export const WorkspaceChildWidget = (props: {
  resource: ResourceRef;
  onOpenSession: (resource: ResourceRef) => void;
}) => {
  const { resource, onOpenSession } = props;

  return (
    <Box h="full" minH="0" minW="0" bg="bg" overflow="auto">
      {resource.kind === "workspace-files" ? <WorkspaceFilesWidget resource={resource} /> : null}
      {resource.kind === "workspace-sessions" ? (
        <WorkspaceSessionsWidget resource={resource} onOpenSession={onOpenSession} />
      ) : null}
    </Box>
  );
};
