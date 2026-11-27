import { HStack, Text } from "@chakra-ui/react";
import type {
  CreatedTeamInviteCode,
  DeviceLogin,
  TeamAccount,
  TeamMember,
  TeamMembershipWrite,
} from "@pstdio/sdk/extensions";
import { DeleteConfirmationModal, SettingsPage } from "@pstdio/ui";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "./button";
import { useCloudContext } from "./cloud-context";
import { CloudError, cloudErrorMessage } from "./cloud-error";
import { CloudIcon } from "./cloud-label";
import { InviteMember } from "./invite-member";
import { TeamActions } from "./team-actions";
import { TeamPeople } from "./team-people";
import { useTeamQuery } from "./team-query";

interface TeamMembersProps {
  team: TeamAccount;
  login: DeviceLogin;
  refresh: () => void;
  selection?: ReactNode;
  actions?: ReactNode;
}

export const TeamMembers = (props: TeamMembersProps) => {
  const { team, login, refresh, selection, actions } = props;
  const { client, t } = useCloudContext();
  const expected = { accountId: login.accountId, managerOrigin: login.managerOrigin };
  const roster = useTeamQuery({ op: "members", accountId: team.accountId }, login);
  const codes = useTeamQuery({ op: "inviteCodes", accountId: team.accountId }, login, team.role === "owner");
  const ownership = useTeamQuery({ op: "ownershipOffer", accountId: team.accountId }, login);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const lifetime = useRef({ open: true });
  const [error, setError] = useState<string>();
  const [inviting, setInviting] = useState(false);
  const [invitation, setInvitation] = useState<CreatedTeamInviteCode>();
  const [advanced, setAdvanced] = useState(false);
  const [confirm, setConfirm] = useState<{ member?: TeamMember }>();
  useEffect(() => {
    const owner = { open: true };
    lifetime.current = owner;
    return () => {
      owner.open = false;
    };
  }, []);
  const changed = () => {
    roster.refresh();
    if (team.role === "owner") codes.refresh();
    ownership.refresh();
    refresh();
  };
  const mutate = async (request: TeamMembershipWrite) => {
    if (working.current) return;
    working.current = true;
    const owner = lifetime.current;
    setBusy(true);
    setError(undefined);
    try {
      const result = await client.account.writeTeamMembership(request, expected);
      if (!owner.open) return;
      if ("code" in result) setInvitation(result);
      if (request.op === "cancelInvitation" && request.invitationId === invitation?.id) setInvitation(undefined);
      setConfirm(undefined);
      changed();
    } catch (cause) {
      if (owner.open) setError(cloudErrorMessage(cause));
      throw cause;
    } finally {
      working.current = false;
      if (owner.open) setBusy(false);
    }
  };
  const invite = () => {
    setInviting(true);
    void mutate({ op: "inviteCode", accountId: team.accountId }).catch(() => {});
  };
  const closeInvite = () => {
    setInviting(false);
    setInvitation(undefined);
    setError(undefined);
  };
  const failure = error ?? roster.error?.message ?? ownership.error?.message;
  return (
    <SettingsPage
      title={t("teams.settings", "Team")}
      icon={<CloudIcon name="users" />}
      description={selection}
      headerActions={
        team.role === "owner" && (
          <Button size="sm" variant="primary" disabled={busy || !roster.data} onClick={invite}>
            <CloudIcon name="plus" />
            {t("members.invite", "Invite member")}
          </Button>
        )
      }
    >
      {roster.data ? (
        <TeamPeople
          members={roster.data}
          userId={login.accountId}
          owner={team.role === "owner"}
          busy={busy}
          remove={(member) => setConfirm({ member })}
        />
      ) : (
        !roster.error && <Text role="status">{t("members.loading", "Loading members…")}</Text>
      )}
      {!inviting && !confirm && failure && (
        <CloudError
          inline
          message={failure}
          onClose={error ? () => setError(undefined) : undefined}
          action={
            <Button size="sm" disabled={busy} onClick={changed}>
              {t("actions.retry", "Retry")}
            </Button>
          }
        />
      )}
      <HStack justify="space-between" flexWrap="wrap">
        <Button size="sm" variant="ghost" aria-expanded={advanced} onClick={() => setAdvanced(!advanced)}>
          {t("teams.actions", "Team actions")}
          <CloudIcon name="chevron-down" />
        </Button>
        {actions}
      </HStack>
      {advanced && (
        <TeamActions
          team={team}
          userId={login.accountId}
          members={roster.data}
          codes={codes.data}
          offer={ownership.data}
          error={team.role === "owner" ? codes.error?.message : undefined}
          busy={busy}
          mutate={mutate}
          leave={() => setConfirm({})}
        />
      )}
      {inviting && (
        <InviteMember
          invitation={invitation}
          busy={busy}
          error={error}
          clearError={() => setError(undefined)}
          retry={invite}
          close={closeInvite}
          revoke={() => {
            if (invitation)
              void mutate({ op: "cancelInvitation", accountId: team.accountId, invitationId: invitation.id })
                .then(closeInvite)
                .catch(() => {});
          }}
        />
      )}
      {confirm && (
        <DeleteConfirmationModal
          open
          onClose={() => setConfirm(undefined)}
          confirmDisabled={busy}
          headline={
            confirm.member
              ? t("members.removeNamed", "Remove {{name}}", { name: confirm.member.name })
              : t("members.leave", "Leave team")
          }
          notificationText={t(
            "members.removeEffect",
            "Access to the team and its projects will be removed. Downloaded copies remain.",
          )}
          buttonText={confirm.member ? t("members.remove", "Remove member") : t("members.leave", "Leave team")}
          onDelete={() =>
            mutate(
              confirm.member
                ? { op: "removeMember", accountId: team.accountId, userId: confirm.member.userId }
                : { op: "leave", accountId: team.accountId },
            )
          }
        >
          {error && <CloudError inline message={error} onClose={() => setError(undefined)} />}
        </DeleteConfirmationModal>
      )}
    </SettingsPage>
  );
};
