import { HStack, Link, Stack, Text } from "@chakra-ui/react";
import { Chip } from "@pstdio/ui";
import { CircleHelp, MessageSquare } from "lucide-react";
import type { ReactNode } from "react";
import type { FoundThread, NewPost } from "../schemas";
import { RankedBars, SentimentBar } from "../webview/charts";

interface SectionProps {
  title: string;
  meta?: string;
  children: ReactNode;
}
const Section = (props: SectionProps) => {
  const { title, meta, children } = props;
  return (
    <Stack gap="sm">
      <HStack justify="space-between">
        <Text textStyle="label/M/medium">{title}</Text>
        {meta ? (
          <Text textStyle="label/XS" color="fg.muted">
            {meta}
          </Text>
        ) : null}
      </HStack>
      {children}
    </Stack>
  );
};
const muted = (text: string) => (
  <Text textStyle="paragraph/S/regular" color="fg.muted">
    {text}
  </Text>
);

export const ThreadInsights = (props: { thread: FoundThread | NewPost }) => {
  const { thread } = props;
  const analysis = thread.analysis;
  const replies = analysis ? Object.values(analysis.replySentiment).reduce((total, count) => total + count, 0) : 0;
  return (
    <Stack gap="lg">
      <Section title="Summary">{muted(analysis?.summary ?? thread.reason)}</Section>
      {analysis ? (
        <>
          <Section title="Sentiment of replies" meta={`${replies} comments`}>
            <SentimentBar counts={analysis.replySentiment} label="Sentiment of replies" />
          </Section>
          <Section title="Common topics in this thread">
            <RankedBars label="Common topics in this thread" rows={analysis.topics} />
          </Section>
          <Section title="Questions people ask">
            {analysis.questions.length
              ? analysis.questions.map((question) => (
                  <HStack key={question} gap="xs" align="start">
                    <CircleHelp size={14} />
                    <Text textStyle="paragraph/S/regular">{question}</Text>
                  </HStack>
                ))
              : muted("No open questions.")}
          </Section>
        </>
      ) : null}
      {thread.status === "answered" ? (
        <Section
          title="Your answer"
          meta={thread.answeredAt ? `Answered ${new Date(thread.answeredAt).toLocaleDateString()}` : undefined}
        >
          {muted(thread.outcome ?? "The next run checks how people responded.")}
        </Section>
      ) : null}
    </Stack>
  );
};

interface PostInsightsProps {
  post: NewPost;
  sourceTitles: Record<string, string>;
  onOpenSource: (id: string) => void;
}
export const PostInsights = (props: PostInsightsProps) => {
  const { post, sourceTitles, onOpenSource } = props;
  return (
    <Stack gap="lg">
      <Section title="Why this post">{muted(post.reason)}</Section>
      {post.basedOn?.length ? (
        <Section title="Based on">
          {post.basedOn.map((source) => (
            <HStack key={source} gap="xs">
              <MessageSquare size={14} />
              {sourceTitles[source] ? (
                <Link as="button" textStyle="paragraph/S/regular" onClick={() => onOpenSource(source)}>
                  {sourceTitles[source]}
                </Link>
              ) : (
                <Text textStyle="mono/XS">{source}</Text>
              )}
            </HStack>
          ))}
        </Section>
      ) : null}
      {post.tags.length ? (
        <Section title="Tags">
          <HStack gap="xs" wrap="wrap">
            {post.tags.map((tag) => (
              <Chip key={tag}>{tag}</Chip>
            ))}
          </HStack>
        </Section>
      ) : null}
      {post.status === "answered" ? <ThreadInsights thread={post} /> : null}
    </Stack>
  );
};
