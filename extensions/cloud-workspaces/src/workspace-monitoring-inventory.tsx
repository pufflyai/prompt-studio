import { Box, Button, Table, Text } from "@chakra-ui/react";
import type { ResourceRef } from "@pstdio/sdk/extensions";
import { Chip, SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { useEffect, useRef, useState } from "react";
import type { MonitoringClient, MonitoringList } from "./workspace-monitoring-client";
import { MonitoringError, monitoringFormat, type Translate } from "./workspace-monitoring-ui";

interface InventoryProps {
  client: MonitoringClient;
  range: string;
  allowedStates: string[];
  name: string;
  open(resource: ResourceRef): void;
  locale: string;
  t: Translate;
}

type PageState = MonitoringList & { cursor?: string };
const empty: PageState = { nextCursor: null, rows: [] };

export function WorkspaceMonitoringInventory(props: InventoryProps) {
  const { client, range, allowedStates, name, open, locale, t } = props;
  const sentinel = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState<PageState>(empty);
  const [cursor, setCursor] = useState<string>();
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState<string>();
  const [dismissed, setDismissed] = useState(false);
  const [initial, setInitial] = useState(true);
  const format = monitoringFormat(locale, t);
  const hasEligibleStates = allowedStates.length > 0;
  const state = allowedStates.length === 1 ? allowedStates[0] : undefined;
  const stateKey = allowedStates.join(",");

  // biome-ignore lint/correctness/useExhaustiveDependencies: The retry counter explicitly starts a fresh read.
  useEffect(() => {
    if (!hasEligibleStates) {
      setInitial(false);
      return;
    }
    const abort = new AbortController();
    setError(undefined);
    setDismissed(false);
    const query = client.commands["deployed.monitoring-workspaces"].query({
      range,
      ...(name ? { name } : {}),
      ...(state ? { state } : {}),
      ...(cursor ? { cursor } : {}),
    });
    void query.refresh(abort.signal).then(
      (next) => {
        if (abort.signal.aborted) return;
        const eligible = new Set(stateKey.split(","));
        const rows = next.rows.filter((row) => eligible.has(row.state));
        setPage((previous) => ({
          cursor,
          nextCursor: next.nextCursor === cursor ? null : next.nextCursor,
          rows: cursor ? [...previous.rows, ...rows] : rows,
        }));
        setInitial(false);
      },
      (error) => {
        if (abort.signal.aborted) return;
        setError(error instanceof Error ? error.message : String(error));
      },
    );
    return () => abort.abort();
  }, [client, range, name, state, stateKey, cursor, retry, hasEligibleStates]);

  useEffect(() => {
    if (!sentinel.current || !page.nextCursor || cursor !== page.cursor || error) return;
    const next = page.nextCursor;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      setCursor(next);
    });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [cursor, page, error]);

  return (
    <SimpleCard minW="0">
      <SimpleCardBody>
        {page.rows.length > 0 && (
          <Box overflowX="auto">
            <Table.Root size="sm" aria-label={t("cloud-workspaces.monitoring-inventory", "Workspaces")}>
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>{t("cloud-workspaces.monitoring-workspace", "Workspace")}</Table.ColumnHeader>
                  <Table.ColumnHeader>{t("cloud-workspaces.status", "Status")}</Table.ColumnHeader>
                  <Table.ColumnHeader>{t("cloud-workspaces.template", "Template")}</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="end">
                    {t("cloud-workspaces.monitoring-runtime", "Ready time in range")}
                  </Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="end">
                    {t("cloud-workspaces.monitoring-estimate-short", "Estimated cost in range")}
                  </Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {page.rows.map((row) => (
                  <Table.Row key={row.resource.id}>
                    <Table.Cell>
                      <Button variant="plain" size="sm" px="0" onClick={() => open(row.resource)}>
                        {row.name}
                      </Button>
                    </Table.Cell>
                    <Table.Cell>
                      <Chip>{row.status}</Chip>
                    </Table.Cell>
                    <Table.Cell>
                      {row.template}@{row.version}
                    </Table.Cell>
                    <Table.Cell textAlign="end" whiteSpace="nowrap">
                      {format.hours(row.runtimeMs)}
                    </Table.Cell>
                    <Table.Cell textAlign="end" whiteSpace="nowrap">
                      {format.money(row.costUsd)}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Box>
        )}
        {error && !dismissed && (
          <MonitoringError
            message={error}
            t={t}
            retry={() => setRetry((value) => value + 1)}
            dismiss={() => setDismissed(true)}
          />
        )}
        {!error && (initial || cursor !== page.cursor || (page.nextCursor && page.rows.length === 0)) && (
          <Text role="status" color="fg.muted">
            {t("cloud-workspaces.monitoring-loading", "Loading workspace monitoring…")}
          </Text>
        )}
        {!initial && !page.nextCursor && page.rows.length === 0 && (
          <Text color="fg.muted">
            {t("cloud-workspaces.monitoring-no-workspaces", "No workspaces match these filters.")}
          </Text>
        )}
        <Box ref={sentinel} h="1" />
      </SimpleCardBody>
    </SimpleCard>
  );
}
