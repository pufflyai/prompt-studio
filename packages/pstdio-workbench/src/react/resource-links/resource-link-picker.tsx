import { Button, HStack, Input, Menu, Stack, Text } from "@chakra-ui/react";
import { type ResourceRole, resourceKey } from "@pstdio/sdk/extensions";
import { AlertMessage, ListRow, ScrollArea } from "@pstdio/ui";
import { useEffect, useState } from "react";
import { WorkbenchIcon } from "../shared/icon";
import type { ResourceLinkCandidate, ResourceLinksService } from "./resource-links-types";

interface ResourceLinkPickerProps {
  service: ResourceLinksService;
  excludeKey: string;
  busy: boolean;
  onCancel(): void;
  onSelect(candidate: ResourceLinkCandidate, role: ResourceRole): Promise<void>;
}

export const ResourceLinkPicker = (props: ResourceLinkPickerProps) => {
  const { service, excludeKey, busy, onCancel, onSelect } = props;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ResourceLinkCandidate[]>([]);
  const [selected, setSelected] = useState<ResourceLinkCandidate>();
  const [role, setRole] = useState<ResourceRole>("context");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [revision, setRevision] = useState(0);
  useEffect(
    () =>
      service.subscribe(() => {
        setSelected(undefined);
        setRevision((value) => value + 1);
      }),
    [service],
  );
  useEffect(() => {
    void revision;
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setResults([]);
    setSelected(undefined);
    setError(undefined);
    const timer = setTimeout(() => {
      void service
        .search(query, controller.signal)
        .then((items) => {
          if (!cancelled) setResults(items.filter((item) => resourceKey(item.resource) !== excludeKey));
        })
        .catch((cause: unknown) => {
          if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 150);
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [service, query, excludeKey, revision]);
  return (
    <Stack gap="3">
      <Input
        size="sm"
        aria-label="Search resources"
        placeholder="Search resources…"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setSelected(undefined);
        }}
        autoFocus
      />
      {error ? <AlertMessage status="error" title={error} /> : null}
      <ScrollArea maxH="64">
        {loading ? (
          <Text color="fg.muted" textStyle="sm">
            Searching…
          </Text>
        ) : null}
        {!loading && !results.length ? (
          <Text color="fg.muted" textStyle="sm">
            No resources found.
          </Text>
        ) : null}
        {results.map((item) => (
          <ListRow
            key={resourceKey(item.resource)}
            label={item.resource.label ?? item.resource.shorthand ?? item.resource.id}
            description={item.description}
            icon={<WorkbenchIcon name={item.resource.icon ?? "file-text"} />}
            isSelected={selected === item}
            onActivate={() => {
              if (!loading && !busy) setSelected(item);
            }}
          />
        ))}
      </ScrollArea>
      <Menu.Root>
        <Menu.Trigger asChild>
          <Button variant="outline" size="sm">
            Purpose: {role}
            <WorkbenchIcon name="chevron-down" />
          </Button>
        </Menu.Trigger>
        <Menu.Positioner>
          <Menu.Content>
            {(["primary", "context", "source", "result"] as const).map((value) => (
              <Menu.Item key={value} value={value} onClick={() => setRole(value)}>
                {value}
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Menu.Root>
      <HStack justify="flex-end">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button
          disabled={!selected || busy || loading}
          loading={busy}
          onClick={() => selected && void onSelect(selected, role)}
        >
          Link
        </Button>
      </HStack>
    </Stack>
  );
};
