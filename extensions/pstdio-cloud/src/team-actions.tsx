import { HStack, Stack, Text } from "@chakra-ui/react";
import type {
  TeamAccount,
  TeamInviteCode,
  TeamMember,
  TeamMembershipWrite,
  TeamOwnershipOffer,
} from "@pstdio/sdk/extensions";
import { Button } from "./button";
import { useCloudContext } from "./cloud-context";
import { CloudError } from "./cloud-error";
import { TeamOwnership } from "./team-ownership";

interface TeamActionsProps {
  team: TeamAccount;
  userId: string;
  members?: TeamMember[];
  codes?: TeamInviteCode[];
  offer?: TeamOwnershipOffer | null;
  busy: boolean;
  error?: string;
  mutate: (request: TeamMembershipWrite) => Promise<void>;
  leave: () => void;
}

export const TeamActions = (props: TeamActionsProps) => {
  const { team, userId, members, codes, offer, busy, error, mutate, leave } = props;
  const { t } = useCloudContext();
  return (
    <Stack gap="md">
      {error && <CloudError inline message={error} />}
      {team.role === "owner" &&
        codes?.map((code) => (
          <HStack key={code.id} justify="space-between">
            <Text color="fg.muted">
              {t("members.expires", "Expires {{date}}", { date: new Date(code.expiresAt).toLocaleString() })}
            </Text>
            <Button
              size="sm"
              variant="destructive-ghost"
              disabled={busy}
              onClick={() => {
                void mutate({ op: "cancelInvitation", accountId: team.accountId, invitationId: code.id }).catch(
                  () => {},
                );
              }}
            >
              {t("members.revokeCode", "Revoke invite")}
            </Button>
          </HStack>
        ))}
      {offer !== undefined && members && (
        <TeamOwnership team={team} userId={userId} roster={members} offer={offer} busy={busy} mutate={mutate} />
      )}
      {team.role === "member" && (
        <Button size="sm" variant="destructive-ghost" alignSelf="start" disabled={busy} onClick={leave}>
          {t("members.leave", "Leave team")}
        </Button>
      )}
    </Stack>
  );
};
