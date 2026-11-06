import { Badge, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { SimpleCard, SimpleCardBody } from "../../components/primitives/simple-card";
import { findRule, type Rule, type Section } from "./book-model";
import { RuleTag, TestTag } from "./book-resource-tag";
import { type ReviewItem, reviewItems } from "./book-review-model";

interface CardProps {
  item: ReviewItem;
  rules: Rule[];
  unread: boolean;
  onRead: (id: string) => void;
  onOpen: (ref: string) => void;
  onReview?: () => void;
}
function ReviewCard({ item, rules, unread, onRead, onOpen, onReview }: CardProps) {
  const [expanded, setExpanded] = useState(false);
  const references = item.requirements.filter((ref) => findRule(rules, ref));
  return (
    <SimpleCard>
      <SimpleCardBody>
        <Stack gap="md">
          <HStack justify="space-between" flexWrap="wrap">
            <HStack gap="sm">
              <Badge colorPalette={item.palette}>{item.kind}</Badge>
              <Text color="fg.muted" textStyle="paragraph/XS/regular">
                {item.id}
              </Text>
            </HStack>
            {unread && (
              <Badge colorPalette="blue" variant="plain">
                New
              </Badge>
            )}
          </HStack>
          <Stack gap="sm">
            <Text as="h2" textStyle="label/L/medium">
              {item.title}
            </Text>
            <Text textStyle="paragraph/S/regular" color="fg.muted">
              {item.summary}
            </Text>
          </Stack>
          {references.length > 0 && (
            <HStack gap="xs" flexWrap="wrap">
              {references.map((ref) => (
                <RuleTag
                  key={ref}
                  reference={ref}
                  title={findRule(rules, ref)?.title}
                  onOpen={() => {
                    onRead(item.id);
                    onOpen(ref);
                  }}
                />
              ))}
            </HStack>
          )}
          {expanded && (
            <Stack gap="sm">
              <Text textStyle="paragraph/S/regular">{item.evidence}</Text>
              {item.tests.length > 0 && (
                <HStack gap="xs" flexWrap="wrap">
                  {item.tests.map((path) => (
                    <TestTag key={path} path={path} />
                  ))}
                </HStack>
              )}
            </Stack>
          )}
          <HStack justify="space-between" gap="sm" flexWrap="wrap">
            <Button
              size="xs"
              variant="ghost"
              aria-expanded={expanded}
              onClick={() => {
                setExpanded(!expanded);
                if (!expanded) onRead(item.id);
              }}
            >
              {expanded ? <ChevronUp /> : <ChevronDown />}
              {expanded ? "Hide details" : "Inspect details"}
            </Button>
            {references.length > 0 && (
              <Button
                size="xs"
                variant="outline"
                onClick={() => {
                  onRead(item.id);
                  if (item.id === "F-1" && onReview) onReview();
                  else onOpen(references[0]);
                }}
              >
                {item.action}
              </Button>
            )}
          </HStack>
        </Stack>
      </SimpleCardBody>
    </SimpleCard>
  );
}
interface ReviewProps {
  section: Section;
  rules: Rule[];
  readIds: string[];
  onRead: (id: string) => void;
  onOpen: (ref: string) => void;
  onReview?: () => void;
}
export function BookReview({ section, rules, readIds, onRead, onOpen, onReview }: ReviewProps) {
  return (
    <Stack gap="md" maxW="4xl">
      {reviewItems
        .filter((item) => item.section === section)
        .map((item) => (
          <ReviewCard
            key={item.id}
            item={item}
            rules={rules}
            unread={!readIds.includes(item.id)}
            onRead={onRead}
            onOpen={onOpen}
            onReview={onReview}
          />
        ))}
    </Stack>
  );
}
