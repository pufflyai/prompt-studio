import { Button, CloseButton, Dialog, HStack, Portal, Spinner, Stack, Text } from "@chakra-ui/react";
import type { ProjectRecoveryPoint, RestoreProjectInput } from "@pstdio/sdk/api";
import { AlertMessage, SearchableMenu } from "@pstdio/ui";
import { useState } from "react";

interface ProjectRecoveryViewProps {
  points: ProjectRecoveryPoint[];
  loading?: boolean;
  error?: string;
  extensionNames?: Record<string, string>;
  onRefresh: () => void;
  onRestore: (input: RestoreProjectInput) => Promise<unknown>;
}

const pointLabel = (hours: number) => (hours === 24 ? "Last day" : `Last ${hours === 1 ? "hour" : "12 hours"}`);

export const ProjectRecoveryView = (props: ProjectRecoveryViewProps) => {
  const { points, loading, error, extensionNames, onRefresh, onRestore } = props;
  const [selected, setSelected] = useState<ProjectRecoveryPoint>();
  const [extensionId, setExtensionId] = useState("");
  const [pending, setPending] = useState(false);
  const [restoreError, setRestoreError] = useState("");
  const [success, setSuccess] = useState(false);
  const restore = async () => {
    if (!selected) return;
    setPending(true);
    setRestoreError("");
    try {
      await onRestore({ hours: selected.hours, capturedAt: selected.capturedAt, ...(extensionId && { extensionId }) });
      setSelected(undefined);
      setSuccess(true);
      onRefresh();
    } catch (error) {
      setRestoreError(error instanceof Error ? error.message : "Restore failed. Try again.");
    } finally {
      setPending(false);
    }
  };
  return (
    <Stack padding="lg" gap="md" maxW="3xl">
      <Text textStyle="heading/S">Recovery</Text>
      <Text textStyle="paragraph/S/regular" color="fg.muted">
        Restore this cloud project or one extension to a recent recovery point. The restore syncs to your other devices.
      </Text>
      {loading ? <Spinner size="sm" /> : null}
      {error ? (
        <AlertMessage status="error" title="Recovery points unavailable">
          {error}
        </AlertMessage>
      ) : null}
      {success ? (
        <AlertMessage status="success" title="Restore saved">
          The restored data will sync to your other devices.
        </AlertMessage>
      ) : null}
      {!loading && !error && points.length === 0 ? (
        <Text color="fg.muted">
          No recovery points on this device yet. Cloud projects capture them automatically while this device is running.
        </Text>
      ) : null}
      {points.map((point) => (
        <HStack key={point.hours} gap="md" py="sm">
          <Stack flex="1" gap="2xs" minW="0">
            <Text textStyle="label/M/medium">{pointLabel(point.hours)}</Text>
            <Text textStyle="paragraph/S/regular" color="fg.muted">
              {new Date(point.capturedAt).toLocaleString()}
            </Text>
          </Stack>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSelected(point);
              setExtensionId("");
              setRestoreError("");
              setSuccess(false);
            }}
          >
            Choose
          </Button>
        </HStack>
      ))}
      <Text textStyle="paragraph/S/regular" color="fg.muted">
        When disk space is low, only the 12-hour recovery point is kept.
      </Text>
      <Button size="sm" variant="ghost" alignSelf="start" onClick={onRefresh} disabled={loading}>
        Refresh recovery points
      </Button>
      <Dialog.Root
        size="sm"
        open={!!selected}
        closeOnInteractOutside={false}
        onOpenChange={(details) => {
          if (!details.open && !pending) setSelected(undefined);
        }}
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Restore project data?</Dialog.Title>
                <Dialog.CloseTrigger asChild>
                  <CloseButton size="sm" disabled={pending} />
                </Dialog.CloseTrigger>
              </Dialog.Header>
              <Dialog.Body>
                <Stack gap="md">
                  <Text textStyle="paragraph/S/regular">
                    Changes sync to your other devices. The current state is kept in a recovery slot so you can undo
                    this restore.
                  </Text>
                  <Text textStyle="paragraph/S/regular" color="fg.muted">
                    {selected ? new Date(selected.capturedAt).toLocaleString() : ""}
                  </Text>
                  <SearchableMenu
                    portalled={false}
                    trigger={
                      <Button size="sm" variant="outline" disabled={pending} aria-label="Restore scope">
                        {extensionId ? (extensionNames?.[extensionId] ?? extensionId) : "Whole project"}
                      </Button>
                    }
                    searchPlaceholder="Find extension"
                    emptyState="No extensions found"
                    items={[
                      { id: "", label: "Whole project" },
                      ...(selected?.extensions ?? []).map((id) => ({ id, label: extensionNames?.[id] ?? id })),
                    ].map((item) => ({
                      ...item,
                      isSelected: item.id === extensionId,
                      onSelect: () => setExtensionId(item.id),
                    }))}
                  />
                  {restoreError ? (
                    <AlertMessage status="error" title="Restore failed">
                      {restoreError}
                    </AlertMessage>
                  ) : null}
                </Stack>
              </Dialog.Body>
              <Dialog.Footer>
                <Button size="sm" variant="outline" disabled={pending} onClick={() => setSelected(undefined)}>
                  Close
                </Button>
                <Button size="sm" loading={pending} onClick={() => void restore()}>
                  Restore
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Stack>
  );
};
