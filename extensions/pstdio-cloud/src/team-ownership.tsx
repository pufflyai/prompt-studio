import { HStack, NativeSelect, Stack, Text } from "@chakra-ui/react";
import type { TeamAccount, TeamMember, TeamMembershipWrite, TeamOwnershipOffer } from "@pstdio/sdk/extensions";
import { useState } from "react";
import { Button } from "./button";
import { useCloudContext } from "./cloud-context";

type OwnershipAction = Extract<TeamMembershipWrite, { op: "offerOwnership" | "answerOwnership" }>;

export const TeamOwnership = (props: {
  team: TeamAccount;
  userId: string;
  roster: TeamMember[];
  offer: TeamOwnershipOffer | null;
  busy: boolean;
  mutate: (request: OwnershipAction) => Promise<void>;
}) => {
  const { team, userId, roster, offer, busy, mutate } = props;
  const { t } = useCloudContext();
  const [selected, select] = useState("");
  const choices = roster.filter(({ role }) => role === "member");
  const target = choices.find((member) => member.userId === selected);

  if (offer) {
    const owner = roster.find((member) => member.userId === offer.ownerUserId);
    const recipient = roster.find((member) => member.userId === offer.recipientUserId);
    const answer = (decision: "accept" | "decline" | "cancel") =>
      mutate({ op: "answerOwnership", accountId: team.accountId, offerId: offer.id, decision });

    if (offer.ownerUserId === userId) {
      return (
        <Stack gap="xs" align="flex-start">
          <Text role="status">
            {t("ownership.pending", "Waiting for {{name}} to accept ownership.", {
              name: recipient?.name ?? offer.recipientUserId,
            })}
          </Text>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void answer("cancel")}>
            {t("ownership.cancel", "Cancel ownership offer")}
          </Button>
        </Stack>
      );
    }

    if (offer.recipientUserId === userId)
      return (
        <Stack gap="xs">
          <Text>
            {t("ownership.incoming", "{{name}} offered you ownership of {{team}}.", {
              name: owner?.name ?? offer.ownerUserId,
              team: team.name,
            })}
          </Text>
          <Text color="fg.muted">{t("ownership.projectAccess", "Your project access stays the same.")}</Text>
          <HStack>
            <Button size="sm" variant="primary" disabled={busy} onClick={() => void answer("accept")}>
              {t("ownership.accept", "Accept ownership")}
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void answer("decline")}>
              {t("ownership.decline", "Decline")}
            </Button>
          </HStack>
        </Stack>
      );
    return null;
  }

  if (team.role !== "owner" || !choices.length) return null;
  return (
    <Stack gap="xs" align="flex-start">
      <Text textStyle="label/M/medium">{t("ownership.title", "Transfer ownership")}</Text>
      <HStack align="flex-end">
        <NativeSelect.Root size="sm" disabled={busy}>
          <NativeSelect.Field
            aria-label={t("ownership.recipient", "New owner")}
            value={target?.userId ?? ""}
            onChange={(event) => select(event.target.value)}
          >
            <option value="" disabled>
              {t("ownership.choose", "Choose a member")}
            </option>
            {choices.map(({ userId, name }) => (
              <option key={userId} value={userId}>
                {name}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !target}
          onClick={() => {
            if (target)
              void mutate({ op: "offerOwnership", accountId: team.accountId, recipientUserId: target.userId });
          }}
        >
          {t("ownership.offer", "Offer ownership")}
        </Button>
      </HStack>
    </Stack>
  );
};
