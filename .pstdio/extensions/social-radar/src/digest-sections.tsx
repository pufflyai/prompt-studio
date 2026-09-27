import { Button, Heading, HStack, Link, Stack, Text } from "@chakra-ui/react";
import { CopyButton, EmptyState, SimpleCard, SimpleCardBody } from "@pstdio/ui";
import type { Idea, Thread } from "./schemas";

interface ThreadsProps {
  threads: Thread[];
  posted?: boolean;
  busy?: boolean;
  onStatus: (id: string, status: Thread["status"]) => void;
}
export const Threads = (props: ThreadsProps) => {
  const { threads, posted = false, busy, onStatus } = props;
  if (!threads.length)
    return (
      <EmptyState
        title={posted ? "No posted replies yet" : "No threads in this digest"}
        description={
          posted
            ? "Copy a reply, post it yourself, then mark it posted."
            : "Your next run will look for conversations worth joining."
        }
      />
    );
  return (
    <Stack gap="md">
      {threads.map((thread) => (
        <SimpleCard key={thread.id}>
          <SimpleCardBody>
            <Stack gap="sm">
              <HStack justify="space-between" flexWrap="wrap">
                <Text textStyle="label/S/medium" color="fg.muted">
                  {thread.site} · {thread.community ?? thread.topic} · Relevance {thread.relevance}
                </Text>
                <Text textStyle="label/XS/regular" color="fg.muted">
                  {thread.status}
                </Text>
              </HStack>
              <Link href={thread.url} target="_blank" rel="noopener noreferrer" textStyle="heading/S/bold">
                {thread.title}
              </Link>
              <Text textStyle="paragraph/S/regular">{thread.excerpt}</Text>
              <Text textStyle="paragraph/S/regular" color="fg.muted">
                {thread.reason}
              </Text>
              {thread.draftReply && (
                <Text textStyle="paragraph/S/regular" whiteSpace="pre-wrap">
                  {thread.draftReply}
                </Text>
              )}
              {posted ? (
                <Stack gap="xs">
                  <Text textStyle="label/S/regular">
                    Posted {thread.postedAt ? new Date(thread.postedAt).toLocaleDateString() : ""}
                  </Text>
                  <Text textStyle="paragraph/S/regular">
                    {thread.outcome ?? "Outcome will be checked on the next run."}
                  </Text>
                </Stack>
              ) : (
                <HStack gap="sm" flexWrap="wrap">
                  {thread.draftReply && <CopyButton text={thread.draftReply} label="Copy reply" />}
                  <Button size="sm" disabled={busy} onClick={() => onStatus(thread.id, "posted")}>
                    Mark posted
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => onStatus(thread.id, thread.status === "saved" ? "new" : "saved")}
                  >
                    {thread.status === "saved" ? "Unsave" : "Save"}
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => onStatus(thread.id, "skipped")}>
                    Skip
                  </Button>
                </HStack>
              )}
            </Stack>
          </SimpleCardBody>
        </SimpleCard>
      ))}
    </Stack>
  );
};
interface IdeasProps {
  ideas: Idea[];
  busy?: boolean;
  onStatus: (id: string, status: Idea["status"]) => void;
}
export const Ideas = (props: IdeasProps) => {
  const { ideas, busy, onStatus } = props;
  if (!ideas.length)
    return (
      <EmptyState
        title="No post ideas in this digest"
        description="Runs suggest topics, demos, showcases, and replies."
      />
    );
  return (
    <Stack gap="md">
      {ideas.map((idea) => (
        <SimpleCard key={idea.id}>
          <SimpleCardBody>
            <Stack gap="sm">
              <Text textStyle="label/S/medium" color="fg.muted">
                {idea.kind} · {idea.sites.join(", ")} · {idea.status}
              </Text>
              <Heading as="h3" textStyle="heading/S/bold">
                {idea.title}
              </Heading>
              <Text textStyle="paragraph/S/regular" whiteSpace="pre-wrap">
                {idea.body}
              </Text>
              <Text textStyle="label/S/regular" color="fg.muted">
                {idea.tags.join(" · ")}
              </Text>
              {idea.basedOn?.length ? (
                <Text textStyle="label/XS/regular" color="fg.muted">
                  Based on: {idea.basedOn.join(", ")}
                </Text>
              ) : null}
              <HStack gap="sm" flexWrap="wrap">
                <CopyButton text={idea.body} label="Copy post" />
                <Button size="sm" disabled={busy} onClick={() => onStatus(idea.id, "used")}>
                  Mark used
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => onStatus(idea.id, idea.status === "saved" ? "new" : "saved")}
                >
                  {idea.status === "saved" ? "Unsave" : "Save"}
                </Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => onStatus(idea.id, "dismissed")}>
                  Dismiss
                </Button>
              </HStack>
            </Stack>
          </SimpleCardBody>
        </SimpleCard>
      ))}
    </Stack>
  );
};
