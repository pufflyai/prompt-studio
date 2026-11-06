import { Badge, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { SearchableMenu } from "../../components/overlays/searchable-menu";
import { SimpleCard, SimpleCardBody } from "../../components/primitives/simple-card";
import type { Rule } from "./book-model";
import type { Observation } from "./book-workflow";

interface ObservationProps {
  observation: Observation;
  rules: Rule[];
  unread: boolean;
  onRead: (id: string) => void;
  onMap: (id: string, ref: string) => void;
  onPromote: (id: string) => void;
}
export function BookObservation(props: ObservationProps) {
  const { observation, rules, unread, onRead, onMap, onPromote } = props;
  const [expanded, setExpanded] = useState(false);
  return (
    <SimpleCard>
      <SimpleCardBody>
        <Stack gap="md">
          <HStack justify="space-between">
            <HStack gap="sm">
              <Badge colorPalette="blue">{observation.kind}</Badge>
              <Text textStyle="paragraph/XS/regular" color="fg.muted">
                {observation.id}
              </Text>
            </HStack>
            {unread && (
              <Badge colorPalette="blue" variant="plain">
                New
              </Badge>
            )}
          </HStack>
          <Text as="h2" textStyle="label/L/medium">
            {observation.title}
          </Text>
          <Text textStyle="paragraph/S/regular">{observation.claim}</Text>
          <Text color="fg.muted" textStyle="paragraph/S/regular">
            {observation.limits}
          </Text>
          {expanded && (
            <Stack gap="sm">
              <Text textStyle="paragraph/XS/regular">{observation.revision}</Text>
              <Text textStyle="paragraph/S/regular">{observation.conditions}</Text>
            </Stack>
          )}
          <HStack gap="sm" flexWrap="wrap" justify="space-between">
            <Button
              size="xs"
              variant="ghost"
              aria-expanded={expanded}
              onClick={() => {
                setExpanded(!expanded);
                onRead(observation.id);
              }}
            >
              {expanded ? "Hide evidence" : "Inspect evidence"}
            </Button>
            <HStack gap="sm" flexWrap="wrap">
              <SearchableMenu
                trigger={
                  <Button size="xs" variant="outline">
                    Map to requirement
                  </Button>
                }
                items={rules.map((rule) => ({
                  id: rule.ref,
                  label: `${rule.ref} ${rule.title}`,
                  searchText: rule.statement,
                  onSelect: () => onMap(observation.id, rule.ref),
                }))}
                searchPlaceholder="Find a requirement…"
                emptyState="No matching requirements"
              />
              <Button size="xs" variant="outline" onClick={() => onPromote(observation.id)}>
                Propose new rule
              </Button>
            </HStack>
          </HStack>
        </Stack>
      </SimpleCardBody>
    </SimpleCard>
  );
}
