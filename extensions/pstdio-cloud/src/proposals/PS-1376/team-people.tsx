import { Avatar, HStack, Input, Stack, Table, Text } from "@chakra-ui/react";
import { AlertMessage, DeleteConfirmationModal, SettingsPage } from "@pstdio/ui";
import { useState } from "react";
import { Button } from "../../button";
import { CloudIcon } from "../../cloud-label";
import { people, type TeamDemo } from "./demo-model";
import { InviteMember } from "./invite-member";

export const JoinTeam = (props: { demo: TeamDemo }) => {
  const { demo } = props;
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const person = people.find((person) => person.id === demo.viewer)!;
  return (
    <SettingsPage title="Team" icon={<CloudIcon name="users" />}>
      <Stack gap="md">
        <Text>Join a team</Text>
        <Input
          aria-label="Invite code"
          placeholder="Enter invite code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
        {demo.invitation === code.trim() && <Text>Join Studio Team as {person.name}</Text>}
        {error && (
          <AlertMessage
            role="alert"
            compact
            status="error"
            title="This invite is unavailable. Ask the owner for a new code."
            onClose={() => setError(false)}
          />
        )}
        <Button alignSelf="start" variant="primary" disabled={!code.trim()} onClick={() => setError(!demo.join(code))}>
          Join team
        </Button>
      </Stack>
    </SettingsPage>
  );
};

export const TeamPeople = (props: { demo: TeamDemo }) => {
  const { demo } = props;
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<string>();
  const person = people.find((person) => person.id === removing);
  return (
    <SettingsPage
      title="Team"
      icon={<CloudIcon name="users" />}
      description={<Text color="fg.muted">Studio Team</Text>}
      headerActions={
        demo.owner && (
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              demo.invite();
              setInviting(true);
            }}
          >
            <CloudIcon name="plus" />
            Invite member
          </Button>
        )
      }
    >
      <Table.Root size="sm" variant="line">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader>Member</Table.ColumnHeader>
            <Table.ColumnHeader>Role</Table.ColumnHeader>
            <Table.ColumnHeader>
              <Text srOnly>Actions</Text>
            </Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {people
            .filter((person) => demo.members.includes(person.id))
            .map((person) => (
              <Table.Row key={person.id}>
                <Table.Cell py="sm">
                  <HStack gap="sm">
                    <Avatar.Root size="sm">
                      <Avatar.Fallback name={person.name} />
                    </Avatar.Root>
                    <Stack gap="0">
                      <Text textStyle="label/M/medium">
                        {person.name}
                        {demo.viewer === person.id ? " (you)" : ""}
                      </Text>
                      <Text color="fg.muted" textStyle="label/S/regular">
                        @{person.handle}
                      </Text>
                    </Stack>
                  </HStack>
                </Table.Cell>
                <Table.Cell color="fg.muted">{person.owner ? "Owner" : "Member"}</Table.Cell>
                <Table.Cell textAlign="end" px="0">
                  {demo.owner && !person.owner && (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Remove ${person.name}`}
                      onClick={() => setRemoving(person.id)}
                    >
                      <CloudIcon name="trash-2" />
                    </Button>
                  )}
                </Table.Cell>
              </Table.Row>
            ))}
        </Table.Body>
      </Table.Root>
      <InviteMember demo={demo} open={inviting} onClose={() => setInviting(false)} />
      <DeleteConfirmationModal
        open={!!person}
        onClose={() => setRemoving(undefined)}
        onDelete={() => demo.removeMember(removing!)}
        headline={`Remove ${person?.name}?`}
        notificationText="They will lose access to the team and its projects."
        buttonText="Remove member"
      />
    </SettingsPage>
  );
};
