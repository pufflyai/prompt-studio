import { Badge, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { AlertMessage, SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { findRule } from "./book-model";
import { BookOperation } from "./book-operation";
import { type Book, operationIssues } from "./model";
import type { Suggestion } from "./records";

export type SuggestionAction = "review" | "apply" | "reconcile" | "discard";
interface SuggestionProps {
  suggestion: Suggestion & { reviewed: boolean };
  branch: Book;
  unread: boolean;
  onRead: (id: string) => void;
  onOpen: (ref: string) => void;
  onAction: (id: string, action: SuggestionAction) => void;
}
export function BookSuggestion(props: SuggestionProps) {
  const { suggestion, branch, unread, onRead, onOpen, onAction } = props;
  const [expanded, setExpanded] = useState(false);
  const issues = suggestion.appliedRevision ? [] : operationIssues(branch, suggestion.operations);
  const status = suggestion.appliedRevision ? "Applied to working branch" : "Local draft";
  return (
    <SimpleCard>
      <SimpleCardBody>
        <Stack gap="md">
          <HStack justify="space-between" flexWrap="wrap">
            <HStack gap="sm">
              <Badge colorPalette={suggestion.appliedRevision ? "green" : "blue"}>{status}</Badge>
              <Text color="fg.muted" textStyle="paragraph/XS/regular">
                {suggestion.id}
              </Text>
            </HStack>
            {unread && (
              <Badge colorPalette="blue" variant="plain">
                New
              </Badge>
            )}
          </HStack>
          <Text as="h2" textStyle="label/L/medium">
            {suggestion.title}
          </Text>
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            {suggestion.reason}
          </Text>
          <HStack gap="xs" flexWrap="wrap">
            {suggestion.operations.map((operation) => (
              <Badge key={`${operation.type}-${operation.after?.ref ?? operation.before?.ref}`}>
                {operation.type} {operation.after?.ref ?? operation.before?.ref}
              </Badge>
            ))}
          </HStack>
          <Button
            size="xs"
            variant="ghost"
            alignSelf="start"
            aria-expanded={expanded}
            onClick={() => {
              setExpanded(!expanded);
              onRead(suggestion.id);
            }}
          >
            {expanded ? <ChevronUp /> : <ChevronDown />}
            {expanded ? "Hide comparison" : "Review changes"}
          </Button>
          {expanded && (
            <Stack gap="lg">
              {issues.length > 0 && (
                <AlertMessage status="warning" title="Reconciliation required">
                  {issues.join(" ")}
                </AlertMessage>
              )}
              {suggestion.operations.map((operation) => (
                <BookOperation
                  key={operation.after?.ref ?? operation.before!.ref}
                  operation={operation}
                  current={findRule(branch.rules, operation.before?.ref ?? "")}
                  onOpen={onOpen}
                />
              ))}
              {suggestion.appliedRevision ? (
                <AlertMessage status="info" title="Working branch updated">
                  These are proposed branch changes. Review and commit them through the existing repository PR workflow.
                </AlertMessage>
              ) : (
                <>
                  {issues.length > 0 && (
                    <Stack gap="sm">
                      <Text textStyle="paragraph/S/regular">
                        Inspect the current branch content above. Keeping the proposal replaces it with the displayed
                        proposed version and clears previous local review.
                      </Text>
                      <HStack flexWrap="wrap" gap="sm">
                        <Button size="xs" variant="outline" onClick={() => onAction(suggestion.id, "reconcile")}>
                          Use proposed content against current
                        </Button>
                        <Button size="xs" variant="ghost" onClick={() => onAction(suggestion.id, "discard")}>
                          Discard suggestion
                        </Button>
                      </HStack>
                    </Stack>
                  )}
                  <HStack justify="space-between" gap="sm" flexWrap="wrap">
                    <HStack gap="sm" flexWrap="wrap">
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={issues.length > 0 || suggestion.reviewed}
                        onClick={() => onAction(suggestion.id, "review")}
                      >
                        {suggestion.reviewed && !issues.length ? "Reviewed locally" : "Mark reviewed"}
                      </Button>
                      <Button
                        size="xs"
                        variant="solid"
                        disabled={issues.length > 0}
                        onClick={() => onAction(suggestion.id, "apply")}
                      >
                        Apply to working branch
                      </Button>
                    </HStack>
                  </HStack>
                </>
              )}
            </Stack>
          )}
        </Stack>
      </SimpleCardBody>
    </SimpleCard>
  );
}
