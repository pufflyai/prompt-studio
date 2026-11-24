import { HStack, NativeSelect, Stack, Text } from "@chakra-ui/react";
import type { DeviceLogin, TeamMember, TeamProjectAccess } from "@pstdio/sdk/extensions";
import { DeleteConfirmationModal } from "@pstdio/ui";
import { useCallback, useEffect, useState } from "react";
import { Button } from "./button";
import { useCloudContext } from "./cloud-context";
import { CloudError } from "./cloud-error";

export const TeamProjectSharing = (props: { accountId: string; login: DeviceLogin; refresh: () => void }) => {
  const { accountId, refresh, login } = props;
  const { client, t } = useCloudContext();
  const { accountId: userId, managerOrigin } = login;
  const [model, setModel] = useState<{ projects: TeamProjectAccess[]; members: TeamMember[] }>();
  const [projectId, setProjectId] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<{ member: TeamMember; project: TeamProjectAccess }>();

  const read = useCallback(async () => {
    const expected = { accountId: userId, managerOrigin };
    const [projects, members] = await Promise.all([
      client.account.readTeamMembership({ op: "projectAccess", accountId }, expected),
      client.account.readTeamMembership({ op: "members", accountId }, expected),
    ]);
    return { projects, members };
  }, [accountId, client, managerOrigin, userId]);

  useEffect(() => {
    const owner = new AbortController();
    void read().then(
      (data) => {
        if (!owner.signal.aborted) setModel(data);
      },
      (cause: unknown) => {
        if (!owner.signal.aborted) setError(String(cause));
      },
    );
    return () => owner.abort();
  }, [read]);

  const run = async (change?: { project: TeamProjectAccess; member: TeamMember; granted: boolean }) => {
    setBusy(true);
    setError(undefined);
    try {
      if (change) {
        await client.account.writeTeamMembership(
          {
            op: "setProjectAccess",
            accountId,
            workbenchId: change.project.workbenchId,
            userId: change.member.userId,
            granted: change.granted,
          },
          { accountId: userId, managerOrigin },
        );
        refresh();
      }
      setModel(await read());
    } catch (cause) {
      setError(String(cause));
    } finally {
      setBusy(false);
      setConfirmation(undefined);
    }
  };

  const selected = projectId ?? model?.projects[0]?.workbenchId;
  const project = model?.projects.find(({ workbenchId }) => workbenchId === selected);
  return (
    <Stack gap="xs">
      {error && (
        <CloudError
          message={error}
          onClose={() => setError(undefined)}
          action={
            <Button size="sm" disabled={busy} onClick={() => void run()}>
              {t("actions.retry", "Retry")}
            </Button>
          }
        />
      )}
      {!model && !error && <Text role="status">{t("sharing.loading", "Loading project access…")}</Text>}
      {model?.projects.length === 0 && <Text color="fg.muted">{t("teams.noProjects", "No cloud projects yet")}</Text>}
      {!!model?.projects.length && (
        <NativeSelect.Root size="sm">
          <NativeSelect.Field
            aria-label={t("sharing.project", "Team project")}
            value={project?.workbenchId ?? ""}
            disabled={busy}
            onChange={(event) => setProjectId(event.target.value)}
          >
            <option value="" disabled>
              {t("sharing.select", "Choose a project")}
            </option>
            {model.projects.map(({ workbenchId, name }) => (
              <option key={workbenchId} value={workbenchId}>
                {name ?? workbenchId}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      )}
      {project &&
        model?.members.map((member) => {
          const shared = project.userIds.includes(member.userId);
          return (
            <HStack key={member.userId} justify="space-between">
              <Text>{member.name}</Text>
              <Button
                size="sm"
                variant={shared ? "destructive-ghost" : "outline"}
                disabled={busy}
                aria-label={
                  shared
                    ? t("sharing.revokeNamed", "Revoke access for {{name}}", { name: member.name })
                    : t("sharing.grantNamed", "Grant access to {{name}}", { name: member.name })
                }
                onClick={() => {
                  if (shared) setConfirmation({ project, member });
                  else void run({ project, member, granted: true });
                }}
              >
                {shared ? t("sharing.revoke", "Revoke access") : t("sharing.grant", "Grant access")}
              </Button>
            </HStack>
          );
        })}
      {confirmation && (
        <DeleteConfirmationModal
          open
          onClose={() => setConfirmation(undefined)}
          onDelete={() => run({ ...confirmation, granted: false })}
          title={t("sharing.revokeNamed", "Revoke access for {{name}}", { name: confirmation.member.name })}
          buttonText={t("sharing.revoke", "Revoke access")}
          notificationText={t(
            "sharing.revokeEffect",
            "New activity will stop syncing to this person after their current access expires. They keep downloaded copies.",
          )}
        >
          <Text>{confirmation.project.name ?? confirmation.project.workbenchId}</Text>
        </DeleteConfirmationModal>
      )}
    </Stack>
  );
};
