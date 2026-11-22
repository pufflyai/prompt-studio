import { Button, HStack, Text } from "@chakra-ui/react";
import { createWebviewClient, registerWebviewResourceAction } from "@pstdio/sdk/extensions";
import { AlertMessage } from "@pstdio/ui";
import { useEffect, useRef, useState } from "react";
import { useExampleView } from "../../view-context";
import type { marmaladeCommands } from "./marmalade-commands";
import { marmaladeStore } from "./marmalade-store";

type Feedback = { kind: "idle" | "saving" | "saved" | "cancelled" | "initiated" } | { kind: "failed"; message: string };

export const MarmaladeExport = () => {
  const { host, resource, t = (_key, fallback) => fallback } = useExampleView();
  const resourceId = resource?.id;
  const resourceType = resource?.type;
  const resourceExtension = resource?.extensionId;
  const resourceProject = resource?.projectId;
  const exportLabel = t("marmalade.export.label", "Export SVG") ?? "Export SVG";
  const [feedback, setFeedback] = useState<Feedback>({ kind: "idle" });
  const retry = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    if (!resourceId || !resourceType) return;
    const lifetime = new AbortController();
    const client = createWebviewClient<typeof marmaladeCommands>(host.bridge);
    let busy = false;
    const run = async (request: AbortSignal) => {
      if (busy || lifetime.signal.aborted) return;
      const signal = AbortSignal.any([lifetime.signal, request]);
      busy = true;
      setFeedback({ kind: "saving" });
      try {
        const documentId = await marmaladeStore.prepareExport();
        signal.throwIfAborted();
        const file = await client.commands["marmalade.export"]({ documentId });
        signal.throwIfAborted();
        const result = await client.files.save({
          name: file.fileName,
          mimeType: file.mimeType,
          data: new TextEncoder().encode(file.svg),
        });
        if (!signal.aborted) setFeedback({ kind: result.status });
      } catch (error) {
        if (!signal.aborted)
          setFeedback({ kind: "failed", message: error instanceof Error ? error.message : String(error) });
      } finally {
        busy = false;
      }
    };
    retry.current = () => run(lifetime.signal);
    setFeedback({ kind: "idle" });
    const action = registerWebviewResourceAction(
      host.bridge,
      {
        resource: { id: resourceId, type: resourceType, extensionId: resourceExtension, projectId: resourceProject },
        label: exportLabel,
        icon: "Download",
      },
      run,
    );
    void action.ready.catch((error) => {
      if (!lifetime.signal.aborted) setFeedback({ kind: "failed", message: String(error) });
    });
    return () => {
      lifetime.abort();
      retry.current = async () => {};
      void action.dispose().catch(() => {});
    };
  }, [host.bridge, resourceId, resourceType, resourceExtension, resourceProject, exportLabel]);
  if (feedback.kind === "idle") return null;
  if (feedback.kind === "failed")
    return (
      <AlertMessage
        compact
        status="error"
        title="Could not export SVG"
        position="absolute"
        top="xs"
        insetInline="sm"
        zIndex="docked"
        onClose={() => setFeedback({ kind: "idle" })}
        endElement={
          <Button size="xs" onClick={() => void retry.current()}>
            Retry
          </Button>
        }
      >
        {feedback.message}
      </AlertMessage>
    );
  const labels = {
    saving: "Exporting SVG…",
    saved: "SVG saved",
    cancelled: "Export cancelled",
    initiated: "Download started",
  };
  return (
    <HStack
      position="absolute"
      top="xs"
      insetInlineStart="sm"
      zIndex="docked"
      bg="bg.panel"
      borderRadius="xs"
      px="sm"
      py="xs"
    >
      <Text role="status" textStyle="label/XS" color="fg.muted">
        {labels[feedback.kind]}
      </Text>
    </HStack>
  );
};
