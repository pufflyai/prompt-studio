import { Field, HStack, Input, Stack, Text } from "@chakra-ui/react";
import type { DeviceLogin, TeamAccount, TeamInvitation, TeamMember, TeamMembershipWrite } from "@pstdio/sdk/extensions";
import { DeleteConfirmationModal } from "@pstdio/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "./button";
import { useCloudContext } from "./cloud-context";
import { CloudError } from "./cloud-error";

type Confirmation = { request: TeamMembershipWrite; member?: string };

export const TeamMembers = (props: { team: TeamAccount; login: DeviceLogin; refresh: () => void }) => {
  const { accountId, managerOrigin } = props.login;
  const { accountId: teamId, role } = props.team;
  const { client, t } = useCloudContext();
  const [roster, setRoster] = useState<TeamMember[]>();
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const inFlight = useRef<AbortController>(undefined);
  const [provider, setProvider] = useState<"google" | "microsoft">("google");
  const [email, setEmail] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [objectId, setObjectId] = useState("");
  const [link, setLink] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [confirm, setConfirm] = useState<Confirmation>();

  const load = useCallback(async () => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    const expected = { accountId, managerOrigin };
    const pending =
      role === "owner"
        ? client.account.readTeamMembership({ op: "invitations", accountId: teamId }, expected)
        : Promise.resolve([]);
    try {
      const [members, outstanding] = await Promise.all([
        client.account.readTeamMembership({ op: "members", accountId: teamId }, expected),
        pending,
      ]);
      if (controller.signal.aborted) return;
      setRoster(members);
      setInvitations(outstanding);
    } catch (cause) {
      if (controller.signal.aborted) return;
      setRoster(undefined);
      setInvitations([]);
      setError(String(cause));
    }
  }, [accountId, managerOrigin, client, role, teamId]);

  useEffect(() => {
    void load();
    return () => inFlight.current?.abort();
  }, [load]);

  const mutate = async (request: TeamMembershipWrite) => {
    setBusy(true);
    setError(undefined);
    setLink(undefined);
    try {
      const result = await client.account.writeTeamMembership(request, { accountId, managerOrigin });
      if ("url" in result) {
        setLink(result.url);
        setEmail("");
        setTenantId("");
        setObjectId("");
      }
      setConfirm(undefined);
      await load();
      props.refresh();
    } catch (cause) {
      setError(String(cause));
      setConfirm(undefined);
    } finally {
      setBusy(false);
    }
  };

  const recipient =
    provider === "microsoft"
      ? { microsoft: { tenantId: tenantId.trim(), objectId: objectId.trim() } }
      : { email: email.trim() };
  const inviteReady = provider === "microsoft" ? !!tenantId.trim() && !!objectId.trim() : !!email.trim();

  return (
    <Stack gap="sm">
      <HStack justify="space-between">
        <Text textStyle="label/M/medium">{t("members.title", "Team members")}</Text>
        <Button size="2xs" variant="ghost" disabled={busy} onClick={() => void load()}>
          {t("members.refresh", "Refresh members")}
        </Button>
      </HStack>
      {!roster && !error && <Text role="status">{t("members.loading", "Loading members…")}</Text>}
      {roster?.map((member) => (
        <HStack key={member.userId} justify="space-between">
          <Text>
            {member.name} · {member.role === "owner" ? t("teams.owner", "Owner") : t("teams.member", "Member")}
          </Text>
          {role === "owner" && member.role === "member" && (
            <Button
              size="2xs"
              variant="ghost"
              disabled={busy}
              aria-label={t("members.removeNamed", "Remove {{name}}", { name: member.name })}
              onClick={() =>
                setConfirm({
                  request: { op: "removeMember", accountId: teamId, userId: member.userId },
                  member: member.name,
                })
              }
            >
              {t("members.remove", "Remove")}
            </Button>
          )}
        </HStack>
      ))}
      {role === "owner" ? (
        <Stack gap="xs">
          <Text color="fg.muted">
            {t("members.separateProjects", "Joining the team does not grant access to projects.")}
          </Text>
          <HStack gap="xs" role="group" aria-label={t("members.recipientProvider", "Invitation sign-in provider")}>
            <Button
              size="sm"
              variant="outline"
              aria-pressed={provider === "google"}
              disabled={busy}
              onClick={() => setProvider("google")}
            >
              {t("members.google", "Google")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              aria-pressed={provider === "microsoft"}
              disabled={busy}
              onClick={() => setProvider("microsoft")}
            >
              {t("members.microsoft", "Microsoft work account")}
            </Button>
          </HStack>
          <Stack
            as="form"
            gap="xs"
            onSubmit={(event) => {
              event.preventDefault();
              if (inviteReady) void mutate({ op: "invite", accountId: teamId, ...recipient });
            }}
          >
            {provider === "microsoft" ? (
              <>
                <Field.Root>
                  <Field.Label>{t("members.tenantId", "Microsoft Entra tenant ID")}</Field.Label>
                  <Input
                    size="sm"
                    required
                    value={tenantId}
                    disabled={busy}
                    maxLength={36}
                    onChange={(event) => setTenantId(event.target.value)}
                  />
                </Field.Root>
                <Field.Root>
                  <Field.Label>{t("members.objectId", "Microsoft Entra user object ID")}</Field.Label>
                  <Input
                    size="sm"
                    required
                    value={objectId}
                    disabled={busy}
                    maxLength={36}
                    onChange={(event) => setObjectId(event.target.value)}
                  />
                  <Field.HelperText>
                    {t("members.directoryIdentity", "Get both IDs for the recipient from your Entra administrator.")}
                  </Field.HelperText>
                </Field.Root>
              </>
            ) : (
              <Field.Root>
                <Field.Label>{t("members.email", "Verified Google email")}</Field.Label>
                <Input
                  size="sm"
                  type="email"
                  required
                  value={email}
                  disabled={busy}
                  maxLength={254}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field.Root>
            )}
            <Button size="sm" variant="outline" type="submit" alignSelf="flex-start" disabled={busy || !inviteReady}>
              {t("members.invite", "Invite person")}
            </Button>
          </Stack>
          {link && (
            <Input
              size="sm"
              value={link}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
              aria-label={t("members.copyInvitation", "Invitation link to copy")}
            />
          )}
          {invitations.map((invitation) => (
            <HStack key={invitation.id} justify="space-between" flexWrap="wrap">
              <Text>{t("members.pending", "Pending")}</Text>
              <Text overflowWrap="anywhere">
                {invitation.email ??
                  (invitation.microsoft &&
                    t(
                      "members.microsoftRecipient",
                      "Microsoft {{objectId}} (tenant {{tenantId}})",
                      invitation.microsoft,
                    ))}
              </Text>
              <Text>{new Date(invitation.expiresAt).toLocaleString()}</Text>
              <Button
                size="2xs"
                variant="ghost"
                disabled={busy}
                onClick={() => void mutate({ op: "cancelInvitation", accountId: teamId, invitationId: invitation.id })}
              >
                {t("members.cancelInvitation", "Cancel invitation")}
              </Button>
            </HStack>
          ))}
          <Text color="fg.muted">{t("members.ownerLimit", "Transfer ownership before leaving the team.")}</Text>
        </Stack>
      ) : (
        <Button
          size="sm"
          variant="outline"
          alignSelf="flex-start"
          disabled={busy}
          onClick={() => setConfirm({ request: { op: "leave", accountId: teamId } })}
        >
          {t("members.leave", "Leave team")}
        </Button>
      )}
      {error && <CloudError message={error} onClose={() => setError(undefined)} />}
      {confirm && (
        <DeleteConfirmationModal
          open
          onClose={() => setConfirm(undefined)}
          headline={
            confirm.member
              ? t("members.removeNamed", "Remove {{name}}", { name: confirm.member })
              : t("members.leaveNamed", "Leave {{name}}", { name: props.team.name })
          }
          buttonText={confirm.member ? t("members.remove", "Remove") : t("members.leave", "Leave team")}
          notificationText={t("members.removeEffect", "Team membership ends. A new invitation is needed to rejoin.")}
          onDelete={() => mutate(confirm.request)}
        />
      )}
    </Stack>
  );
};
