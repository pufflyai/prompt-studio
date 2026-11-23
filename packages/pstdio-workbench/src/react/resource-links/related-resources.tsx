import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import { type ResourceRef, type ResourceRole, resourceKey } from "@pstdio/sdk/extensions";
import { AlertMessage, ScopedDialog as Dialog, ListRow, ScrollArea } from "@pstdio/ui";
import { useEffect, useRef, useState } from "react";
import { WorkbenchIcon } from "../shared/icon";
import { ResourceLinkPicker } from "./resource-link-picker";
import { ResourceLinkProgress } from "./resource-link-progress";
import type { ResourceLinkCandidate, ResourceLinksService } from "./resource-links-types";
import { type RelatedResourceRow, useResourceLinkRows } from "./use-resource-link-rows";

interface RelatedResourcesProps {
  resource: ResourceRef;
  service: ResourceLinksService;
  onClose(): void;
}

const RelatedResourceListRow = (props: {
  row: RelatedResourceRow;
  onOpen(candidate: ResourceLinkCandidate): Promise<void>;
  onRemove(source: ResourceRef, target: ResourceRef): Promise<void>;
}) => {
  const {
    row: { edge, candidate, incoming },
    onOpen,
    onRemove,
  } = props;
  return (
    <ListRow
      label={
        candidate.resource.label ??
        candidate.resource.shorthand ??
        `${candidate.resource.type}: ${candidate.resource.id}`
      }
      description={`${incoming ? "Incoming" : "Outgoing"} · ${edge.target.role ?? "context"}${candidate.open ? "" : " · Unavailable"}`}
      tooltip={`${candidate.resource.extensionId ?? "pstdio"} · ${candidate.resource.type}: ${candidate.resource.id}`}
      icon={<WorkbenchIcon name={candidate.resource.icon ?? "file-text"} />}
      onActivate={
        candidate.open
          ? () => {
              void onOpen(candidate);
            }
          : undefined
      }
      actionsVisibility="always"
      actions={[
        {
          id: "resource-actions",
          label: "Link actions",
          icon: <WorkbenchIcon name="ellipsis" />,
          menuItems: [
            {
              id: "open",
              label: "Open resource",
              icon: <WorkbenchIcon name="arrow-up-right" />,
              disabled: !candidate.open,
              onAction: () => void onOpen(candidate),
            },
            {
              id: "remove",
              label: "Remove link",
              icon: <WorkbenchIcon name="unlink" />,
              onAction: () => void onRemove(edge.source, edge.target),
            },
          ],
        },
      ]}
    />
  );
};

const ResourceLinkPagination = (props: {
  cursor?: string;
  nextCursor?: string;
  loading: boolean;
  onChange(cursor?: string): void;
}) => {
  const { cursor, nextCursor, loading, onChange } = props;
  if (!cursor && !nextCursor) return null;
  return (
    <HStack>
      {cursor ? (
        <Button variant="ghost" onClick={() => onChange()} disabled={loading}>
          First page
        </Button>
      ) : null}
      {nextCursor ? (
        <Button variant="ghost" onClick={() => onChange(nextCursor)} disabled={loading}>
          More resources
        </Button>
      ) : null}
    </HStack>
  );
};

export const RelatedResources = (props: RelatedResourcesProps) => {
  const { resource, service, onClose } = props;
  const [cursor, setCursor] = useState<string>();
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const adding = useRef(false);
  const { rows, changes, nextCursor, loading, readError, refresh } = useResourceLinkRows(service, resource, cursor);
  useEffect(() => {
    const signal = service.retirementSignal;
    if (!signal) return;
    if (signal.aborted) {
      onClose();
      return;
    }
    signal.addEventListener("abort", onClose, { once: true });
    return () => signal.removeEventListener("abort", onClose);
  }, [service, onClose]);
  const key = resourceKey(resource);
  const unconfirmed = changes.some(({ status }) => status === "unknown" || status === "unconfirmed");
  const pending = changes.some(({ status }) => status === "queued" || status === "writing" || status === "reconciling");

  const failure = error ?? readError;
  const empty = !rows.length && !(loading || failure || pending || unconfirmed);
  const run = async (action: () => Promise<void>) => {
    setError(undefined);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };
  const update = (action: () => Promise<void>) =>
    run(async () => {
      await action();
      if (!service.changes) refresh();
    });
  const add = async (candidate: ResourceLinkCandidate, role: ResourceRole) => {
    if (adding.current) return;
    adding.current = true;
    setBusy(true);
    try {
      await update(async () => {
        await service.add(resource, [{ ...candidate.resource, role }]);
        setPicker(false);
        setCursor(undefined);
      });
    } finally {
      adding.current = false;
      setBusy(false);
    }
  };
  const remove = (source: ResourceRef, target: ResourceRef) => update(() => service.remove(source, [target]));
  const open = (candidate: ResourceLinkCandidate) =>
    run(async () => {
      await candidate.open?.();
      onClose();
    });
  return (
    <>
      <Dialog.Header textAlign="start">
        <Dialog.Title>{picker ? "Link resource" : "Related resources"}</Dialog.Title>
      </Dialog.Header>
      <Dialog.Body textAlign="start">
        <Stack gap="3">
          <ListRow
            label={resource.label ?? resource.shorthand ?? resource.id}
            icon={<WorkbenchIcon name={resource.icon ?? "link"} />}
            actionsVisibility="always"
            actions={
              picker
                ? []
                : [
                    {
                      id: "links",
                      label: "Related resource actions",
                      icon: <WorkbenchIcon name="ellipsis" />,
                      disabled: busy,
                      menuItems: [
                        {
                          id: "link",
                          label: "Link resource",
                          icon: <WorkbenchIcon name="link" />,
                          onAction: () => setPicker(true),
                        },
                      ],
                    },
                  ]
            }
          />
          {failure ? <AlertMessage status="error" title={failure} /> : null}
          <ResourceLinkProgress pending={pending} unconfirmed={unconfirmed} />
          {picker ? (
            <ResourceLinkPicker
              service={service}
              excludeKey={key}
              busy={busy}
              onCancel={() => setPicker(false)}
              onSelect={add}
            />
          ) : (
            <>
              {loading ? (
                <Text color="fg.muted" textStyle="sm">
                  Loading resources…
                </Text>
              ) : null}
              {empty ? (
                <Text color="fg.muted" textStyle="sm">
                  {cursor ? "No related resources on this page." : "No related resources yet."}
                </Text>
              ) : null}
              <ScrollArea maxH="80">
                {rows.map((row) => (
                  <RelatedResourceListRow
                    key={JSON.stringify([resourceKey(row.edge.source), resourceKey(row.edge.target)])}
                    row={row}
                    onOpen={open}
                    onRemove={remove}
                  />
                ))}
              </ScrollArea>
              <ResourceLinkPagination cursor={cursor} nextCursor={nextCursor} loading={loading} onChange={setCursor} />
            </>
          )}
        </Stack>
      </Dialog.Body>
    </>
  );
};
