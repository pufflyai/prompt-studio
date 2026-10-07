// Show the selected ticket's place in the ticket tree, its requests, blockers, and dependencies.
import { Box, Button, CloseButton, Flex, Stack, Text } from "@chakra-ui/react";
import type { NavigationTarget } from "@pstdio/sdk/extensions";
import { ScrollArea } from "@pstdio/ui";
import type { Plan, PlanLink, PlanRow } from "../contracts";
import { ActionsPanel } from "./actions-panel";
import { ArtifactPanel } from "./artifact-panel";
import { BlockReasonPanel } from "./block-reason-panel";
import { toneColor } from "./flags";
import { GatePanel } from "./gate-panel";
import { InstructionLinks } from "./instruction-navigation";
import { type Review, ReviewBar } from "./review-bar";
import { StatusIcon } from "./status-icon";
import type { PlanClient } from "./use-plan";

interface DetailsProps {
  row: PlanRow;
  plan: Plan;
  client: PlanClient;
  onOpen: (target: NavigationTarget) => void;
  onSelect: (id: string) => void;
  onClose: () => void;
  // Present while stepping through a milestone's tickets that need a person.
  review?: Review;
}

function Links({ title, links, onSelect }: { title: string; links: PlanLink[]; onSelect: (id: string) => void }) {
  if (links.length === 0) {
    return null;
  }

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

export function Details({ row, plan, client, onOpen, onSelect, onClose, review }: DetailsProps) {
  return (
    <Box
      w={row.artifact ? { base: "320px", lg: "400px" } : { base: "260px", lg: "320px" }}
      flexShrink="0"
      minH="0"
      borderLeftWidth="1px"
      borderColor="border.subtle"
    >
      <ScrollArea h="full" minH="0">
        <Stack p="md" gap="md">
          {review ? <ReviewBar review={review} /> : null}
          <Flex align="start" gap="sm">
            <Stack gap="xs" flex="1" minW="0">
              <Flex align="center" gap="xs">
                <StatusIcon row={row} />
                <Text textStyle="label/S/medium" color="fg.muted">
                  {[...row.ancestors, row].map(({ shorthand }) => shorthand).join("/")}
                </Text>
              </Flex>
              <Text textStyle="label/L/medium">{row.title}</Text>
            </Stack>
            <CloseButton size="sm" aria-label="Close details" onClick={onClose} />
          </Flex>
          <InstructionLinks row={row} plan={plan} onOpen={onOpen}>
            <BlockReasonPanel row={row} />
          </InstructionLinks>
          {row.gate ? <GatePanel row={row} client={client} /> : null}
          {!row.gate ? (
            <ArtifactPanel key={row.artifact?.url ?? "none"} row={row} client={client} onOpen={onOpen} />
          ) : null}
          <InstructionLinks row={row} plan={plan} onOpen={onOpen}>
            <ActionsPanel row={row} client={client} />
          </InstructionLinks>
          {row.laterDependencies.length ? (
            <Text textStyle="label/S/regular" color={toneColor.warning}>
              Placed before {row.laterDependencies.map(({ shorthand }) => shorthand).join(", ")}, which it depends on.
            </Text>
          ) : null}
          <Links title="Depends on" links={row.dependsOn} onSelect={onSelect} />
          <Links title="Holding up" links={row.blocks} onSelect={onSelect} />
          <Button size="sm" variant="outline" onClick={() => onOpen(row.target)}>
            Open ticket
          </Button>
        </Stack>
      </ScrollArea>
    </Box>
  );
}
