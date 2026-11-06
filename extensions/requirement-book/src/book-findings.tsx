import { Badge, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { useState } from "react";
import { RuleTag } from "./book-resource-tag";
import type { BookData } from "./read";

interface Props {
  finding: BookData["findings"][number];
  onRead: (id: string) => void;
  onOpen: (ref: string) => void;
  onResolve: () => void;
}
export function BookFinding(props: Props) {
  const { finding, onRead, onOpen, onResolve } = props;
  const [expanded, setExpanded] = useState(false);
  return (
    <SimpleCard>
      <SimpleCardBody>
        <Stack gap="md">
          <HStack justify="space-between">
            <Badge colorPalette={finding.kind === "violation" ? "red" : "orange"}>
              {finding.kind.replaceAll("-", " ")}
            </Badge>
            {finding.resolved && <Badge colorPalette="green">Resolved</Badge>}
            {finding.unread && !finding.resolved && <Badge colorPalette="blue">New</Badge>}
          </HStack>
          <Text as="h2" textStyle="label/L/medium">
            {finding.title}
          </Text>
          <Text textStyle="paragraph/S/regular">{finding.explanation}</Text>
          <HStack gap="xs" flexWrap="wrap">
            {finding.requirements.map((ref) => (
              <RuleTag key={ref} reference={ref} onOpen={onOpen} />
            ))}
          </HStack>
          {expanded && (
            <Stack gap="sm">
              {finding.evidence.map((item, index) => (
                <Text key={`${index}-${item}`} textStyle="paragraph/XS/regular">
                  {item}
                </Text>
              ))}
              {finding.observations.map((id) => (
                <Text key={id} textStyle="paragraph/XS/regular">
                  Evidence record {id}
                </Text>
              ))}
            </Stack>
          )}
          <HStack justify="space-between">
            <Button
              size="xs"
              variant="ghost"
              aria-expanded={expanded}
              onClick={() => {
                setExpanded(!expanded);
                onRead(finding.id);
              }}
            >
              {expanded ? "Hide details" : "Inspect details"}
            </Button>
            <Button size="xs" variant="outline" disabled={finding.resolved} onClick={onResolve}>
              {finding.resolved ? "Resolved" : "Resolve finding"}
            </Button>
          </HStack>
        </Stack>
      </SimpleCardBody>
    </SimpleCard>
  );
}
