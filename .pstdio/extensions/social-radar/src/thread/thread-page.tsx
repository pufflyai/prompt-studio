import { Badge, Box, Button, Flex, HStack, IconButton, Link, Menu, Portal, Text } from "@chakra-ui/react";
import { useCommandMutation, useCommandQuery } from "@pstdio/sdk/extensions/react";
import { AlertMessage, EmptyState, ScrollArea } from "@pstdio/ui";
import { Ellipsis, ExternalLink } from "lucide-react";
import { type Idea, isNewPost, type Thread } from "../schemas";
import { siteLabels } from "../sites";
import { threadResource } from "../store";
import { plural } from "../text";
import { useOpenThread, useRadar, useRadarRefresh, useRadarResource } from "../webview/client";
import { Conversation } from "./conversation";
import { PostInsights, ThreadInsights } from "./insights";
import { NewPostDraft } from "./new-post";

const statusPalette: Record<Thread["status"], string> = {
  new: "purple",
  idea: "yellow",
  answered: "green",
  skipped: "gray",
};
const statusLabel: Record<Thread["status"], string> = {
  new: "New",
  idea: "Idea",
  answered: "Answered",
  skipped: "Skipped",
};
// Each status offers the moves the rules allow; a skipped thread returns to its open status.
const statusActions = (thread: Thread) => {
  const open = isNewPost(thread) ? "idea" : "new";
  if (thread.status === "answered") return [];
  if (thread.status === "skipped") return [{ value: open, label: "Restore" }];
  if (isNewPost(thread)) return [{ value: "skipped", label: "Skip" }];
  return [
    { value: "answered", label: "Mark answered" },
    { value: "skipped", label: "Skip" },
  ];
};
const metaLine = (thread: Thread) => {
  if (isNewPost(thread))
    return [siteLabels[thread.site], "new post", thread.url ? "posted" : "not posted yet"].join(" · ");
  const post = thread.snapshot?.post;
  return [
    siteLabels[thread.site],
    thread.community,
    post?.score === undefined ? "" : plural(post.score, "upvote"),
    post?.commentCount === undefined ? "" : plural(post.commentCount, "comment"),
  ]
    .filter(Boolean)
    .join(" · ");
};

export const ThreadPage = () => {
  const resource = useRadarResource();
  if (!resource) return <EmptyState title="No thread open" description="Pick a thread in the thread list." />;
  return <ThreadView key={resource.id} id={resource.id} />;
};

const ThreadView = (props: { id: string }) => {
  const { id } = props;
  const { client } = useRadar();
  const openThread = useOpenThread();
  useRadarRefresh();
  const data = useCommandQuery({ queryKey: ["thread", id], command: () => client.commands["get-thread"]({ id }) });
  const invalidate = [["thread", id]];
  const status = useCommandMutation({
    command: (input: { status: Thread["status"]; url?: string }) =>
      client.commands["set-thread-status"]({ id, ...input }),
    invalidate,
  });
  const updateThread = useCommandMutation({
    command: (input: { draft: string }) => client.commands["update-thread"]({ id, input }),
    invalidate,
  });
  const updateIdea = useCommandMutation({
    command: (input: { id: string; body: string }) =>
      client.commands["update-idea"]({ id: input.id, input: { body: input.body } }),
    invalidate,
  });
  const ideaStatus = useCommandMutation({
    command: (input: { id: string; status: Idea["status"] }) => client.commands["set-idea-status"](input),
    invalidate,
  });
  const error = data.error ?? status.error ?? updateThread.error ?? updateIdea.error ?? ideaStatus.error;
  if (!data.data) return error ? <AlertMessage status="error" title={error.message} /> : null;
  const { thread, ideas, mediaRule, sourceTitles } = data.data;
  const draft = isNewPost(thread) && thread.status !== "answered";
  const actions = statusActions(thread);
  return (
    <Flex direction="column" h="full" minH="0">
      <HStack gap="sm" px="lg" py="sm" borderBottomWidth="1px" borderColor="border.subtle" flexShrink={0}>
        <Badge colorPalette={statusPalette[thread.status]}>{statusLabel[thread.status]}</Badge>
        {!isNewPost(thread) && thread.mention ? <Badge colorPalette="blue">@ Mentions us</Badge> : null}
        {isNewPost(thread) ? <Badge variant="outline">{thread.kind}</Badge> : null}
        <Text flex="1" textStyle="label/S/regular" color="fg.muted" truncate>
          {metaLine(thread)}
        </Text>
        {thread.url ? (
          <Button asChild size="xs" variant="outline">
            <Link href={thread.url} target="_blank" rel="noopener noreferrer" title={thread.url}>
              <ExternalLink />
              Open thread
            </Link>
          </Button>
        ) : null}
        {actions.length ? (
          <Menu.Root onSelect={({ value }) => status.mutate({ status: value as Thread["status"] })}>
            <Menu.Trigger asChild>
              <IconButton size="xs" variant="ghost" aria-label="Thread actions">
                <Ellipsis />
              </IconButton>
            </Menu.Trigger>
            <Portal>
              <Menu.Positioner>
                <Menu.Content>
                  {actions.map((action) => (
                    <Menu.Item key={action.value} value={action.value}>
                      {action.label}
                    </Menu.Item>
                  ))}
                </Menu.Content>
              </Menu.Positioner>
            </Portal>
          </Menu.Root>
        ) : null}
      </HStack>
      {error ? <AlertMessage status="error" title={error.message} /> : null}
      <Flex flex="1" minH="0">
        <ScrollArea flex="1" minW="0">
          <Box maxW="3xl" mx="auto" p="lg">
            {draft ? (
              <NewPostDraft
                post={thread}
                mediaRule={mediaRule}
                onEdit={(text) => updateThread.mutate({ draft: text })}
                onDismiss={() => status.mutate({ status: "skipped" })}
                onPosted={(url) => status.mutate({ status: "answered", url })}
              />
            ) : (
              <Conversation
                thread={thread}
                ideas={ideas}
                onEditIdea={(ideaId, body) => updateIdea.mutate({ id: ideaId, body })}
                onIdeaStatus={(ideaId, value) => ideaStatus.mutate({ id: ideaId, status: value })}
              />
            )}
          </Box>
        </ScrollArea>
        <ScrollArea w="sm" flexShrink={0} borderStartWidth="1px" borderColor="border.subtle">
          <Box p="lg">
            {isNewPost(thread) ? (
              <PostInsights
                post={thread}
                sourceTitles={sourceTitles}
                onOpenSource={(source) =>
                  openThread({ type: threadResource.id, id: source, label: sourceTitles[source] })
                }
              />
            ) : (
              <ThreadInsights thread={thread} />
            )}
          </Box>
        </ScrollArea>
      </Flex>
    </Flex>
  );
};
