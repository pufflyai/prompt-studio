import { Avatar, HStack, Stack, Table, Text } from "@chakra-ui/react";
import type { TeamMember } from "@pstdio/sdk/extensions";
import { Button } from "./button";
import { useCloudContext } from "./cloud-context";
import { CloudIcon } from "./cloud-label";

interface TeamPeopleProps {
  members: TeamMember[];
  userId: string;
  owner: boolean;
  busy?: boolean;
  remove: (member: TeamMember) => void;
}

export const TeamPeople = (props: TeamPeopleProps) => {
  const { members, userId, owner, busy, remove } = props;
  const { t } = useCloudContext();
  return (
    <Table.Root size="sm" variant="line">
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeader>{t("members.person", "Member")}</Table.ColumnHeader>
          <Table.ColumnHeader>{t("members.role", "Role")}</Table.ColumnHeader>
          <Table.ColumnHeader>
            <Text srOnly>{t("members.actions", "Actions")}</Text>
          </Table.ColumnHeader>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {members.map((member) => (
          <Table.Row key={member.userId}>
            <Table.Cell py="sm">
              <HStack gap="sm">
                <Avatar.Root size="sm">
                  <Avatar.Fallback name={member.name} />
                </Avatar.Root>
                <Stack gap="0" minW="0">
                  <Text textStyle="label/M/medium" truncate>
                    {member.name}
                    {userId === member.userId ? t("members.you", " (you)") : ""}
                  </Text>
                </Stack>
              </HStack>
            </Table.Cell>
            <Table.Cell color="fg.muted">
              {member.role === "owner" ? t("teams.owner", "Owner") : t("teams.member", "Member")}
            </Table.Cell>
            <Table.Cell textAlign="end" px="0">
              {owner && member.role !== "owner" && (
                <Button
                  size="sm"
                  variant="destructive-ghost"
                  disabled={busy}
                  aria-label={t("members.removeNamed", "Remove {{name}}", { name: member.name })}
                  onClick={() => remove(member)}
                >
                  <CloudIcon name="trash-2" />
                </Button>
              )}
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
};
