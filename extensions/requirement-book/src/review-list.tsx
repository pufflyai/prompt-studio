import { Stack, Text } from "@chakra-ui/react";
import { BookFinding } from "./book-findings";
import { BookSuggestion, type SuggestionAction } from "./book-suggestion";
import type { BookClient } from "./client";
import type { Section } from "./model";
import type { BookData } from "./read";

interface Props {
  data: BookData;
  section: Section;
  focusedId?: string;
  client: BookClient;
  run: (action: () => Promise<unknown>) => void;
  onOpen: (ref: string) => void;
}
export function ReviewList(props: Props) {
  const { data, section, focusedId, client, run, onOpen } = props;
  const markRead = (id: string) =>
    run(() => client.commands["review.mark-read"]({ workspaceId: data.workspaceId, ids: [id] }));
  const onAction = (id: string, action: SuggestionAction) => {
    const item = data.suggestions.find((value) => value.id === id)!;
    run(async () => {
      if (action === "apply") return client.commands["suggestions.apply"]({ id, expectedDigest: item.digest });
      if (action === "review") return client.commands["suggestions.review"]({ id, expectedDigest: item.digest });
      if (action === "reconcile") return client.commands["suggestions.reconcile"]({ id, expectedDigest: item.digest });
      if (action === "discard") return client.commands["suggestions.discard"]({ id });
    });
  };
  const findings = data.findings.filter((item) => (focusedId ? item.id === focusedId : !item.resolved));
  const suggestions = data.suggestions.filter((item) => !focusedId || item.id === focusedId);
  return (
    <Stack gap="md" maxW="6xl">
      {section === "Findings" && (
        <>
          {findings.map((finding) => (
            <BookFinding
              key={finding.id}
              finding={finding}
              onRead={markRead}
              onOpen={onOpen}
              onResolve={() => run(() => client.commands["findings.save"]({ ...finding, resolved: true }))}
            />
          ))}
          {!findings.length && <Text color="fg.muted">No active findings.</Text>}
        </>
      )}
      {section === "Suggestions" && (
        <>
          {suggestions.map((item) => (
            <BookSuggestion
              key={item.id}
              suggestion={item}
              branch={{ version: 1, chapters: data.chapters, rules: data.rules, retired: data.retired }}
              unread={item.unread}
              onRead={markRead}
              onOpen={onOpen}
              onAction={onAction}
            />
          ))}
          {!suggestions.length && <Text color="fg.muted">No local suggestions.</Text>}
        </>
      )}
    </Stack>
  );
}
