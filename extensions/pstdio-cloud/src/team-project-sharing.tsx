import { Avatar, HStack, Stack, Text } from "@chakra-ui/react";
import type { DeviceLogin, TeamMember } from "@pstdio/sdk/extensions";
import { Checkbox, DeleteConfirmationModal } from "@pstdio/ui";
import { useRef, useState } from "react";
import { Button } from "./button";
import { useCloudContext } from "./cloud-context";
import { CloudError } from "./cloud-error";
import { useTeamQuery } from "./team-query";

interface TeamProjectSharingProps {
  accountId: string;
  projectId: string;
  login: DeviceLogin;
  refresh: () => void;
}

export const TeamProjectSharing = (props: TeamProjectSharingProps) => {
  const { accountId, projectId, refresh, login } = props;
  const { client, t } = useCloudContext();
  const expected = { accountId: login.accountId, managerOrigin: login.managerOrigin };
  const projects = useTeamQuery({ op: "projectAccess", accountId }, login);
  const members = useTeamQuery({ op: "members", accountId }, login);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const [confirmation, setConfirmation] = useState<TeamMember>();
  const project = projects.data?.find(({ workbenchId }) => workbenchId === projectId);
  const reload = () => {
    projects.refresh();
    members.refresh();
    refresh();
  };
  const change = async (member: TeamMember, granted: boolean) => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await client.account.writeTeamMembership(
        { op: "setProjectAccess", accountId, workbenchId: projectId, userId: member.userId, granted },
        expected,
      );
      setConfirmation(undefined);
      reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      throw cause;
    } finally {
      working.current = false;
      setBusy(false);
    }
  };
  const failure = error ?? projects.error?.message ?? members.error?.message;
  return (
    <Stack gap="sm">
      <Text textStyle="label/M/medium">{t("sharing.title", "Project access")}</Text>
      {(!projects.data || !members.data) && !failure && (
        <Text role="status">{t("sharing.loading", "Loading project access…")}</Text>
      )}
      {project &&
        members.data?.map((member) => {
          const granted = project.userIds.includes(member.userId);
          return (
            <HStack key={member.userId} justify="space-between">
              <HStack gap="sm">
                <Avatar.Root size="xs">
                  <Avatar.Fallback name={member.name} />
                </Avatar.Root>
                <Text>{member.name}</Text>
              </HStack>
              <Checkbox
                checked={granted}
                disabled={busy}
                inputProps={{
                  "aria-label": t("sharing.accessNamed", "Project access for {{name}}", { name: member.name }),
                }}
                onCheckedChange={({ checked }) => {
                  if (checked) void change(member, true).catch(() => {});
                  else setConfirmation(member);
                }}
              />
            </HStack>
          );
        })}
      {projects.data && members.data && !project && (
        <Text color="fg.muted">{t("sharing.unavailable", "This project is no longer available to your account.")}</Text>
      )}
      {!confirmation && failure && (
        <CloudError
          inline
          message={failure}
          onClose={error ? () => setError(undefined) : undefined}
          action={
            <Button size="sm" disabled={busy} onClick={reload}>
              {t("actions.retry", "Retry")}
            </Button>
          }
        />
      )}
      {confirmation && (
        <DeleteConfirmationModal
          open
          onClose={() => setConfirmation(undefined)}
          confirmDisabled={busy}
          onDelete={() => change(confirmation, false)}
          headline={t("sharing.revokeNamed", "Revoke access for {{name}}", { name: confirmation.name })}
          buttonText={t("sharing.revoke", "Revoke access")}
          notificationText={t(
            "sharing.revokeEffect",
            "New activity will stop syncing to this person after their current access expires. They keep downloaded copies.",
          )}
        >
          {error && <CloudError inline message={error} onClose={() => setError(undefined)} />}
        </DeleteConfirmationModal>
      )}
    </Stack>
  );
};
