import { HStack, Input, Stack, Text } from "@chakra-ui/react";
import { Chip, SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { useState } from "react";
import { Button } from "../../button";
import { people, type TeamDemo } from "./demo-model";

export const JoinTeam = (props: { demo: TeamDemo }) => {
  const { demo } = props;
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  return (
    <SimpleCard>
      <SimpleCardBody>
        <Stack gap="md">
          <Text textStyle="heading/S">Join a team</Text>
          <Text color="fg.muted">Enter an invite code shared by your team.</Text>
          <Input aria-label="Invite code" value={code} onChange={(event) => setCode(event.target.value)} />
          {demo.invitation && code.trim() === demo.invitation && (
            <Stack gap="xs">
              <Text textStyle="label/M/medium">Studio Team</Text>
              <Text color="fg.muted">
                Join as {people.find((person) => person.id === demo.viewer)!.name}. Project access is granted
                separately.
              </Text>
            </Stack>
          )}
          {error && (
            <Text role="alert" color="fg.error">
              {error}
            </Text>
          )}
          <Button
            alignSelf="start"
            variant="primary"
            disabled={!code.trim()}
            onClick={() => {
              if (!demo.join(code)) setError("This invitation is unavailable. Ask the team owner for a new code.");
            }}
          >
            Accept invitation
          </Button>
        </Stack>
      </SimpleCardBody>
    </SimpleCard>
  );
};

export const TeamPeople = (props: { demo: TeamDemo }) => {
  const { demo } = props;
  const [copied, setCopied] = useState(false);
  return (
    <Stack gap="md">
      <HStack justify="space-between">
        <Text textStyle="heading/S">
          Members{" "}
          <Text as="span" color="fg.muted">
            {demo.members.length}
          </Text>
        </Text>
        {demo.owner && (
          <Button
            variant="primary"
            onClick={() => {
              demo.invite();
              setCopied(false);
            }}
          >
            Create invite
          </Button>
        )}
      </HStack>
      {demo.invitation && demo.owner && (
        <SimpleCard>
          <SimpleCardBody>
            <Stack gap="sm">
              <HStack justify="space-between">
                <Text textStyle="label/M/medium">Team invitation</Text>
                <Chip>Pending</Chip>
              </HStack>
              <Text color="fg.muted">Expires in 24 hours · Team membership only</Text>
              <HStack gap="sm" flexWrap="wrap">
                <Input flex="1" aria-label="Team invite code" readOnly value={demo.invitation} />
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(demo.invitation!);
                      setCopied(true);
                    } catch {
                      setCopied(false);
                    }
                  }}
                >
                  {copied ? "Copied" : "Copy code"}
                </Button>
                <Button variant="destructive-ghost" onClick={demo.revoke}>
                  Revoke invite
                </Button>
              </HStack>
            </Stack>
          </SimpleCardBody>
        </SimpleCard>
      )}
      <SimpleCard>
        <SimpleCardBody>
          <Stack gap="md">
            {people
              .filter((person) => demo.members.includes(person.id))
              .map((person) => (
                <HStack key={person.id} justify="space-between" gap="sm" flexWrap="wrap">
                  <Stack gap="2xs">
                    <Text>
                      {person.name}
                      {demo.viewer === person.id ? " (you)" : ""}
                    </Text>
                    <Text textStyle="label/S/regular" color="fg.muted">
                      {person.role}
                    </Text>
                  </Stack>
                  <HStack gap="sm">
                    <Text color="fg.muted">
                      {demo.projects.filter((project) => project.members.includes(person.id)).length} projects
                    </Text>
                    {demo.owner && person.id !== "alex" && (
                      <Button size="sm" variant="destructive-ghost" onClick={() => demo.removeMember(person.id)}>
                        Remove {person.name.split(" ")[0]}
                      </Button>
                    )}
                  </HStack>
                </HStack>
              ))}
          </Stack>
        </SimpleCardBody>
      </SimpleCard>
    </Stack>
  );
};
