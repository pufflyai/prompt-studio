import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import { type ResourceAnchorPage, type ResourceRef, type ResourceRole, resourceKey } from "@pstdio/sdk/extensions";
import { AlertMessage, ScopedDialog as Dialog, ListRow, ScrollArea } from "@pstdio/ui";
import { useEffect, useState } from "react";
import { WorkbenchIcon } from "../shared/icon";
import { ResourceLinkPicker } from "./resource-link-picker";
import type { ResourceLinkCandidate, ResourceLinksService } from "./resource-links-types";

interface RelatedResourcesProps {
  resource: ResourceRef;
  service: ResourceLinksService;
  onClose(): void;
}

interface RelatedResourceRow {
  edge: ResourceAnchorPage["items"][number];
  candidate: ResourceLinkCandidate;
  incoming: boolean;
}

export const RelatedResources = (props: RelatedResourcesProps) => {
  const { resource, service, onClose } = props;
  const [rows, setRows] = useState<RelatedResourceRow[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [nextCursor, setNextCursor] = useState<string>();
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [revision, setRevision] = useState(0);
  const key = resourceKey(resource);
  useEffect(
    () =>
      service.subscribe(() => {
        setRevision((value) => value + 1);
      }),
    [service],
  );
  useEffect(() => {
    void revision;
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError(undefined);
    void service
      .list({ resource, direction: "both", limit: 25, cursor })
      .then(async (page) => {
        if (cancelled) return;
        const refs = page.items.map((edge) => (resourceKey(edge.source) === key ? edge.target : edge.source));
        const resolved = await service.resolve(refs, controller.signal);
        if (cancelled) return;
        const candidates = new Map(resolved.map((item) => [resourceKey(item.resource), item]));
        setRows(
          page.items.map((edge, index) => ({
            edge,
            incoming: resourceKey(edge.source) !== key,
            candidate: candidates.get(resourceKey(refs[index]!)) ?? { resource: refs[index]! },
          })),
        );
        setNextCursor(page.nextCursor);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [resource, key, cursor, revision, service]);
  const mutate = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try {
      await action();
      setPicker(false);
      setCursor(undefined);
      setRevision((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };
  const add = (candidate: ResourceLinkCandidate, role: ResourceRole) =>
    mutate(() => service.add(resource, [{ ...candidate.resource, role }]));
  const open = async (candidate: ResourceLinkCandidate) => {
    setError(undefined);
    try {
      await candidate.open?.();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };
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
          {error ? <AlertMessage status="error" title={error} /> : null}
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
              {!loading && !rows.length && !error ? (
                <Text color="fg.muted" textStyle="sm">
                  No related resources yet.
                </Text>
              ) : null}
              <ScrollArea maxH="80">
                {rows.map(({ edge, candidate, incoming }) => (
                  <ListRow
                    key={`${resourceKey(edge.source)}:${resourceKey(edge.target)}`}
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
                            void open(candidate);
                          }
                        : undefined
                    }
                    actionsVisibility="always"
                    actions={[
                      {
                        id: "resource-actions",
                        label: "Link actions",
                        icon: <WorkbenchIcon name="ellipsis" />,
                        disabled: busy,
                        menuItems: [
                          {
                            id: "open",
                            label: "Open resource",
                            icon: <WorkbenchIcon name="arrow-up-right" />,
                            disabled: !candidate.open,
                            onAction: () => void open(candidate),
                          },
                          {
                            id: "remove",
                            label: "Remove link",
                            icon: <WorkbenchIcon name="unlink" />,
                            onAction: () => void mutate(() => service.remove(edge.source, [edge.target])),
                          },
                        ],
                      },
                    ]}
                  />
                ))}
              </ScrollArea>
              {cursor || nextCursor ? (
                <HStack>
                  {cursor ? (
                    <Button variant="ghost" onClick={() => setCursor(undefined)} disabled={loading}>
                      First page
                    </Button>
                  ) : null}
                  {nextCursor ? (
                    <Button variant="ghost" onClick={() => setCursor(nextCursor)} disabled={loading}>
                      More resources
                    </Button>
                  ) : null}
                </HStack>
              ) : null}
            </>
          )}
        </Stack>
      </Dialog.Body>
    </>
  );
};
