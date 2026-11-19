import { Button, Flex, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { PlannerReadError } from "../../views/planner-read-error";
import type { PlanLink } from "../contracts";
import { type PlanClient, planEvents } from "./use-plan";
import { usePlannerQuery } from "./use-planner-query";

export function Links(props: { title: string; links: PlanLink[]; onSelect: (id: string) => void }) {
  const { title, links, onSelect } = props;
  if (!links.length) return null;
  return (
    <Stack gap="xs">
      <Text textStyle="label/S/medium" color="fg.muted">
        {title}
      </Text>
      <Flex gap="xs" wrap="wrap">
        {links.map((link) => (
          <Button key={link.id} size="2xs" variant="outline" onClick={() => onSelect(link.id)}>
            {link.done ? "✓ " : ""}
            {link.shorthand}
          </Button>
        ))}
      </Flex>
    </Stack>
  );
}
export function RelationshipWindow(props: {
  client: PlanClient;
  ticketId: string;
  direction: "dependsOn" | "blocks";
  onSelect: (id: string) => void;
}) {
  const { client, ticketId, direction, onSelect } = props;
  const [offset, setOffset] = useState(0);
  const { value, error, retry } = usePlannerQuery(
    client,
    client.commands["timeline.relations.read"].query({ ticketId, direction, offset }, { events: planEvents }),
  );
  if (!value) return <PlannerReadError error={error} retry={retry} />;
  return (
    <Stack gap="xs">
      <PlannerReadError error={error} retry={retry} />
      <Links title={direction === "dependsOn" ? "Depends on" : "Holding up"} links={value.links} onSelect={onSelect} />
      {value.total > 25 || offset > 0 ? (
        <Flex align="center" gap="sm">
          <Button size="xs" variant="outline" disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 25))}>
            Previous
          </Button>
          <Text textStyle="label/S/regular">
            {offset + 1}–{Math.min(offset + 25, value.total)} of {value.total}
          </Text>
          <Button size="xs" variant="outline" disabled={!value.hasNext} onClick={() => setOffset(offset + 25)}>
            Next
          </Button>
        </Flex>
      ) : null}
    </Stack>
  );
}
