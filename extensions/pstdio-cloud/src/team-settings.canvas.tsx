import { HStack, Stack, Text } from "@chakra-ui/react";
import { createWebviewClient, type TeamMember } from "@pstdio/sdk/extensions";
import { DeleteConfirmationModal, SettingsPage } from "@pstdio/ui";
import { type ReactNode, useState } from "react";
import { Button } from "./button";
import { CloudContext } from "./cloud-context";
import { CloudIcon } from "./cloud-label";
import { InviteMember } from "./invite-member";
import { ManagedExtensionRows } from "./managed-extensions";
import type { cloudCommands } from "./project-state";
import { TeamPeople } from "./team-people";

export default {
  title: "Cloud/Team settings",
  description: "Production presentation components with synthetic people and policy; no account calls.",
};

const client = createWebviewClient<typeof cloudCommands>({
  extensionId: "pstdio.cloud",
  call: async () => {
    throw new Error("Canvas has no account service");
  },
  onEvent: () => () => {},
});
const people: TeamMember[] = [
  { userId: "alex", name: "Alex Morgan", role: "owner" },
  { userId: "riley", name: "Riley Chen", role: "member" },
  { userId: "sam", name: "Sam Rivera", role: "member" },
];
const Context = (props: { children: ReactNode }) => {
  const { children } = props;
  return (
    <CloudContext
      value={{
        client,
        t: (key, fallback = key, values) =>
          fallback.replace(/\{\{(\w+)\}\}/g, (_match, name) => String(values?.[name] ?? name)),
      }}
    >
      {children}
    </CloudContext>
  );
};

const TeamFrame = (props: { owner: boolean }) => {
  const { owner } = props;
  const [members, setMembers] = useState(people);
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<TeamMember>();
  return (
    <Context>
      <Stack h="2xl" maxH="full" minH="0">
        <SettingsPage
          title="Team"
          icon={<CloudIcon name="users" />}
          description={<Text color="fg.muted">Studio Team</Text>}
          headerActions={
            owner && (
              <Button size="sm" variant="primary" onClick={() => setInviting(true)}>
                <CloudIcon name="plus" />
                Invite member
              </Button>
            )
          }
        >
          <TeamPeople members={members} userId={owner ? "alex" : "riley"} owner={owner} remove={setRemoving} />
          <HStack>
            <Button size="sm" variant="ghost">
              Team actions
              <CloudIcon name="chevron-down" />
            </Button>
          </HStack>
        </SettingsPage>
        {inviting && (
          <InviteMember
            invitation={{
              id: "synthetic-invite",
              code: "synthetic_canvas_code_not_a_live_invitation_1",
              expiresAt: "2026-12-01T18:00:00Z",
            }}
            busy={false}
            clearError={() => {}}
            retry={() => {}}
            revoke={() => setInviting(false)}
            close={() => setInviting(false)}
          />
        )}
        {removing && (
          <DeleteConfirmationModal
            open
            onClose={() => setRemoving(undefined)}
            headline={`Remove ${removing.name}?`}
            notificationText="Access to the team and its projects will be removed. Downloaded copies remain."
            buttonText="Remove member"
            onDelete={() => {
              setMembers(members.filter(({ userId }) => userId !== removing.userId));
              setRemoving(undefined);
            }}
          />
        )}
      </Stack>
    </Context>
  );
};
export const OwnerTeam = () => <TeamFrame owner />;
export const MemberTeam = () => <TeamFrame owner={false} />;

const ManagedFrame = (props: { owner: boolean }) => {
  const { owner } = props;
  const [required, setRequired] = useState(["pstdio.notes"]);
  return (
    <Context>
      <Stack h="2xl" maxH="full" minH="0">
        <SettingsPage
          title="Managed extensions"
          icon={<CloudIcon name="package-check" />}
          description={
            <Stack gap="sm">
              <Text color="fg.muted">Studio Team</Text>
              <Text color="fg.muted">
                Selected extensions are installed automatically in team projects. Only the team owner can change them.
              </Text>
            </Stack>
          }
        >
          <ManagedExtensionRows
            owner={owner}
            ready
            rows={[
              { extensionId: "pstdio.notes", name: "Notes", icon: "notebook", version: "1.0.0" },
              { extensionId: "pstdio.planner", name: "Planner", icon: "list-todo", version: "1.0.0" },
            ].map((row) => ({
              ...row,
              source: { ...row, instanceId: row.extensionId },
              decision: {
                extensionId: row.extensionId,
                selectionId: "synthetic-selection",
                required: required.includes(row.extensionId)
                  ? { ...row, revision: "a".repeat(64), selectionId: "synthetic-selection" }
                  : null,
              },
            }))}
            change={(row, managed) =>
              setRequired(managed ? [...required, row.extensionId] : required.filter((id) => id !== row.extensionId))
            }
          />
        </SettingsPage>
      </Stack>
    </Context>
  );
};
export const OwnerManagedExtensions = () => <ManagedFrame owner />;
export const MemberManagedExtensions = () => <ManagedFrame owner={false} />;
