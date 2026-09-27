import { Box, Button, Flex, Stack, Text } from "@chakra-ui/react";
import { createWebviewClient, type GuestHost, type PropsStore, type ResourceRef } from "@pstdio/sdk/extensions";
import { Header, ScrollArea } from "@pstdio/ui";
import { useState, useSyncExternalStore } from "react";
import { defaultSettings, getItem } from "./catalog";
import type { commands } from "./commands";
import { useReviewSettings } from "./use-review-settings";

export interface PreviewProps {
  resource?: ResourceRef;
}
interface PreviewRootProps {
  host: GuestHost;
  propsStore: PropsStore<PreviewProps>;
}
interface ReviewPreviewProps {
  host: GuestHost;
  id: string;
}

const ReviewPreview = (props: ReviewPreviewProps) => {
  const { host, id } = props;
  const { settings, error } = useReviewSettings(host, id);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const reset = async () => {
    setSaving(true);
    setSaveError(undefined);
    try {
      await createWebviewClient<typeof commands>(host).commands["review.update"]({ id, ...defaultSettings(id) });
    } catch (reason) {
      setSaveError(String(reason));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Flex direction="column" h="full" minH="0" minW="0" overflow="hidden">
      <ScrollArea flex="1" minH="0" minW="0" viewportProps={{ "aria-label": "Review preview" }}>
        <Stack p="lg" gap="md">
          {error || saveError ? (
            <Text role="alert" color="fg.error">
              {error ?? saveError}
            </Text>
          ) : null}
          {settings ? (
            <>
              <Text textStyle="heading/M">{settings.heading}</Text>
              <Text textStyle="paragraph/M/regular">{getItem(id).description}</Text>
              {settings.showDetails ? (
                <Stack gap="sm">
                  {["Purpose", "Inputs", "Output", "Review", "Ownership", "Next steps"].map((section) => (
                    <Box key={section} layerStyle="panel" p="md">
                      <Text textStyle="label/M/medium">{section}</Text>
                      <Text textStyle="paragraph/M/regular" color="fg.muted">
                        Sample {section.toLowerCase()} for {getItem(id).label.toLowerCase()}. Review this detail with
                        your team before continuing.
                      </Text>
                    </Box>
                  ))}
                </Stack>
              ) : null}
            </>
          ) : (
            <Text role="status">Loading preview…</Text>
          )}
        </Stack>
      </ScrollArea>
      <Header flexShrink="0" borderTopWidth="1px" borderColor="border.subtle" px="sm">
        <Button size="sm" variant="ghost" disabled={saving || !settings} onClick={() => void reset()}>
          Reset settings
        </Button>
      </Header>
    </Flex>
  );
};

export const PreviewRoot = (props: PreviewRootProps) => {
  const { host, propsStore } = props;
  const { resource } = useSyncExternalStore(propsStore.subscribe, propsStore.get, propsStore.get);
  if (!resource) return <Text p="md">Select a review item.</Text>;
  // Rebinding a single-instance view resets transient UI state, not saved settings.
  return <ReviewPreview key={resource.id} host={host} id={resource.id} />;
};
