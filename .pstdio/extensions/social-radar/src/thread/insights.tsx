import { HStack, Icon, Link, Stack, Text } from "@chakra-ui/react";
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
const Muted = (props: { text: string }) => {
  const { text } = props;
  return (
    <Text textStyle="paragraph/S/regular" color="fg.muted">
      {text}
    </Text>
  );
};

export const ThreadInsights = (props: { thread: FoundThread | NewPost }) => {
  const { thread } = props;
  const analysis = thread.analysis;
  const replies = analysis ? Object.values(analysis.replySentiment).reduce((total, count) => total + count, 0) : 0;
  return (
    <Stack gap="lg">
      <Section title="Summary">
        <Muted text={analysis?.summary ?? thread.reason} />
      </Section>
      {analysis ? (
        <>
          <Section title="Sentiment of replies" meta={`${replies} comments`}>
            <SentimentBar counts={analysis.replySentiment} label="Sentiment of replies" />
          </Section>
          <Section title="Common topics in this thread">
            <RankedBars label="Common topics in this thread" rows={analysis.topics} fixedHeight />
          </Section>
          <Section title="Questions people ask">
            {analysis.questions.length ? (
              analysis.questions.map((question, index) => (
                <HStack key={`${index}-${question}`} gap="xs" align="start">
                  <Icon as={CircleHelp} boxSize="icon-xs" />
                  <Text textStyle="paragraph/S/regular">{question}</Text>
                </HStack>
              ))
            ) : (
              <Muted text="No open questions." />
            )}
          </Section>
        </>
      ) : null}
      {thread.status === "answered" ? (
        <Section
          title="Your answer"
          meta={thread.answeredAt ? `Answered ${new Date(thread.answeredAt).toLocaleDateString()}` : undefined}
        >
          <Muted text={thread.outcome ?? "The next run checks how people responded."} />
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
      <Section title="Why this post">
        <Muted text={post.reason} />
      </Section>
      {post.basedOn?.length ? (
        <Section title="Based on">
          {post.basedOn.map((source, index) => (
            <HStack key={`${index}-${source}`} gap="xs">
              <Icon as={MessageSquare} boxSize="icon-xs" />
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
            {post.tags.map((tag, index) => (
              <Chip key={`${index}-${tag}`}>{tag}</Chip>
            ))}
          </HStack>
        </Section>
      ) : null}
      {post.analysis ? <ThreadInsights thread={post} /> : null}
    </Stack>
  );
};
