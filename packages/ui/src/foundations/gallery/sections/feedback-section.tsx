import { Badge, Button, HStack, Icon, Text } from "@chakra-ui/react";
import { FileText } from "lucide-react";
import { AlertMessage } from "@/components/primitives/alert";
import { ContentPlaceholder } from "@/components/primitives/content-placeholder";
import { EmptyState } from "@/components/primitives/empty-state";
import { InfoCard } from "@/components/primitives/info-card";
import { SessionIndicator, sessionCompletionStatuses } from "@/components/primitives/session-indicator";
import { SimpleCard, SimpleCardBody } from "@/components/primitives/simple-card";
import { GalleryCard, GallerySection } from "../gallery-frame";

export const FeedbackSection = () => {
  return (
    <GallerySection title="Feedback & status" description="Alerts, empty states, status indicators, and cards.">
      <GalleryCard title="Alerts" names={["AlertMessage"]}>
        <AlertMessage status="info" title="Pipeline saved" />
        <AlertMessage status="success" title="Workspace ready">
          <Text>Everything is configured and ready to go.</Text>
        </AlertMessage>
        <AlertMessage status="warning" title="Merge conflicts detected" />
        <AlertMessage status="error" title="Hook failed" />
        <AlertMessage
          status="error"
          title="Could not load conversation"
          onClose={() => {}}
          endElement={<Button>Retry</Button>}
        >
          <Text>The server had a temporary problem.</Text>
        </AlertMessage>
        <AlertMessage status="error" title="Could not load conversation" onClose={() => {}}>
          <Text>This session no longer exists.</Text>
        </AlertMessage>
      </GalleryCard>

      <GalleryCard title="Empty state" names={["EmptyState"]}>
        <EmptyState
          title="No documents yet."
          description="Upload files to start building extractions."
          icon={<Icon as={FileText} boxSize="28px" color="fg.muted" />}
        >
          <Button size="sm" variant="outline">
            Upload files
          </Button>
        </EmptyState>
      </GalleryCard>

      <GalleryCard title="Session indicator" names={["SessionIndicator"]}>
        <HStack gap="md" flexWrap="wrap">
          {sessionCompletionStatuses.map((status) => (
            <HStack key={status} gap="2xs">
              <SessionIndicator status={status} />
              <Text textStyle="label/S/regular">{status}</Text>
            </HStack>
          ))}
        </HStack>
      </GalleryCard>

      <GalleryCard title="Placeholder" names={["ContentPlaceholder"]}>
        <ContentPlaceholder height="120px" width="100%" />
      </GalleryCard>

      <GalleryCard title="Cards" names={["InfoCard", "SimpleCard"]} gridColumn={{ base: "auto", xl: "span 2" }}>
        <SimpleCard>
          <SimpleCardBody>
            <InfoCard
              title="Fraud review pipeline"
              description="Checks incoming claims against historical activity for anomalies."
              badge={
                <Badge size="lg" variant="subtle" colorPalette="blue">
                  Pipeline
                </Badge>
              }
              infoItems={[
                { label: "Created", value: "Sep 18, 2024" },
                { label: "Updated", value: "Oct 2, 2024" },
              ]}
              actions={[
                <Button key="run" size="md" variant="primary">
                  Run
                </Button>,
              ]}
            />
          </SimpleCardBody>
        </SimpleCard>
        <SimpleCard>
          <SimpleCardBody>
            <Text textStyle="paragraph/M/medium">Simple card content</Text>
          </SimpleCardBody>
        </SimpleCard>
      </GalleryCard>
    </GallerySection>
  );
};
