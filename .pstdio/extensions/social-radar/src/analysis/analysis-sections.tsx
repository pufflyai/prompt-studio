import { Box, Flex, Grid, HStack, Text } from "@chakra-ui/react";
import { EmptyState, ListRow, ScrollArea, SimpleCard, SimpleCardBody } from "@pstdio/ui";
import type { ReactNode } from "react";
import type { RadarAnalysis } from "../analysis";
import { siteLabels } from "../sites";
import { DailyBars, RankedBars, SentimentBar, sentimentTokens } from "../webview/charts";

interface KpiProps {
  label: string;
  value: number;
  detail?: string;
}
const Kpi = (props: KpiProps) => {
  const { label, value, detail } = props;
  return (
    <SimpleCard>
      <SimpleCardBody>
        <Text textStyle="label/S/regular" color="fg.muted">
          {label}
        </Text>
        <HStack gap="xs" align="baseline">
          <Text textStyle="heading/XL">{value}</Text>
          {detail ? (
            <Text textStyle="label/XS" color="fg.muted">
              {detail}
            </Text>
          ) : null}
        </HStack>
      </SimpleCardBody>
    </SimpleCard>
  );
};

interface CardProps {
  title: string;
  meta?: string;
  children: ReactNode;
}
// Cards fill their grid cell, and their content takes the height left under the title.
const Card = (props: CardProps) => {
  const { title, meta, children } = props;
  return (
    <SimpleCard minW="0" minH="0" display="flex" flexDirection="column">
      <SimpleCardBody flex="1" minH="0" display="flex" flexDirection="column" gap="md">
        <HStack justify="space-between" flexShrink={0}>
          <Text textStyle="label/M/medium">{title}</Text>
          {meta ? (
            <Text textStyle="label/XS" color="fg.muted">
              {meta}
            </Text>
          ) : null}
        </HStack>
        {children}
      </SimpleCardBody>
    </SimpleCard>
  );
};

const signed = (value: number) => (value > 0 ? `+${value}` : String(value));
const shortDate = (value: string) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });

interface AnalysisSectionsProps {
  analysis: RadarAnalysis;
  onOpenMention: (mention: RadarAnalysis["recentMentions"][number]) => void;
}
export const AnalysisSections = (props: AnalysisSectionsProps) => {
  const { analysis, onOpenMention } = props;
  const { mentions, threadsFound, answered, postsUsed, days } = analysis;
  return (
    <Flex direction="column" gap="md" flex="1" minH="0">
      <Grid templateColumns="repeat(4, minmax(0, 1fr))" gap="md" flexShrink={0}>
        <Kpi label="Mentions" value={mentions.count} detail={signed(mentions.change)} />
        <Kpi label="Threads found" value={threadsFound} />
        <Kpi label="Answered" value={answered.count} detail={`${answered.gotReply} got a reply`} />
        <Kpi label="Post ideas used" value={postsUsed.count} detail={`of ${postsUsed.total}`} />
      </Grid>
      <Grid
        templateColumns="minmax(0, 3fr) minmax(0, 2fr)"
        templateRows="repeat(2, minmax(0, 1fr))"
        gap="md"
        flex="1"
        minH="0"
      >
        <Card title="Mentions per day">
          <DailyBars days={analysis.mentionsPerDay} label={`Mentions per day over ${days} days`} />
        </Card>
        <Card title="Mentions" meta={`${mentions.count} in ${days} days`}>
          <SentimentBar counts={analysis.mentionSentiment} label="Mentions by sentiment" />
          {analysis.mentionsBySite.length ? (
            <RankedBars
              label="Mentions by site"
              rows={analysis.mentionsBySite.map((row) => ({ label: siteLabels[row.site], count: row.count }))}
            />
          ) : null}
        </Card>
        <Card title="Common topics" meta={`${threadsFound} threads`}>
          {analysis.topics.length ? (
            <RankedBars label="Common topics" rows={analysis.topics} />
          ) : (
            <EmptyState title="No topics yet" description="The agent tags topics when it saves a thread." />
          )}
        </Card>
        <Card title="Recent mentions" meta="Opens the thread">
          {analysis.recentMentions.length ? (
            <ScrollArea flex="1" minH="0">
              {analysis.recentMentions.map((mention) => (
                <ListRow
                  key={mention.id}
                  id={mention.id}
                  variant="full-width"
                  label={mention.title}
                  icon={<Box boxSize="2" borderRadius="full" bg={sentimentTokens[mention.sentiment ?? "neutral"]} />}
                  endContent={
                    <Text textStyle="label/XS" color="fg.muted">
                      {siteLabels[mention.site]} · {shortDate(mention.foundAt)}
                    </Text>
                  }
                  onActivate={() => onOpenMention(mention)}
                />
              ))}
            </ScrollArea>
          ) : (
            <EmptyState title="No mentions yet" description="Threads that name a brand term appear here." />
          )}
        </Card>
      </Grid>
    </Flex>
  );
};
