import "@pstdio/ui/style.css";
import { Box, Button, ChakraProvider, Flex, HStack, Input, NativeSelect, Stack, Table, Text } from "@chakra-ui/react";
import { createWebviewClient, defineExtensionView } from "@pstdio/sdk/extensions";
import { Chip, DeleteConfirmationModal, psTheme, ScrollArea, SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import type { deployedTemplateChoices, launchDeployedWorkspace } from "./deployed-launch";
import type { stopDeployedWorkspace } from "./deployed-machine";
import type { DeployedMachineRow, deployedMachinesCommands } from "./deployed-machines-commands";
import {
  deployedMachineFilterOptions,
  emptyDeployedMachineFilters,
  filterDeployedMachines,
} from "./deployed-machines-filters";
import { deployedMachinePageRef, deployedPageRef } from "./lab-navigation";
import { MonitoringError } from "./workspace-monitoring-ui";

type CommandDefinitions = typeof deployedMachinesCommands & {
  "deployed.template-choices": typeof deployedTemplateChoices;
  "deployed.machine-launch": typeof launchDeployedWorkspace;
  "deployed.machine-stop": typeof stopDeployedWorkspace;
};

function FilterSelect(props: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange(value: string): void;
}) {
  const { label, value, options, onChange } = props;
  return (
    <Stack gap="2xs" minW="9rem">
      <Text textStyle="label/XS" color="fg.muted">
        {label}
      </Text>
      <NativeSelect.Root size="sm">
        <NativeSelect.Field value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
          <option value="">All</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>
    </Stack>
  );
}

export default defineExtensionView({
  render(context) {
    const { host, mount, propsStore, t } = context;
    const client = createWebviewClient<CommandDefinitions>(host);
    const root = createRoot(mount);

    function MachinesView() {
      const props = useSyncExternalStore(propsStore.subscribe, propsStore.get);
      const controller = props.resource;
      const [rows, setRows] = useState<DeployedMachineRow[]>();
      const [templates, setTemplates] = useState<{ value: string; label: string }[]>();
      const [filters, setFilters] = useState(emptyDeployedMachineFilters);
      const [error, setError] = useState<string>();
      const [dismissed, setDismissed] = useState(false);
      const [refresh, setRefresh] = useState(0);
      const [launching, setLaunching] = useState(false);
      const [template, setTemplate] = useState("");
      const [name, setName] = useState("");
      const [pendingStop, setPendingStop] = useState<DeployedMachineRow>();

      // biome-ignore lint/correctness/useExhaustiveDependencies: The retry counter explicitly starts a fresh read.
      useEffect(() => {
        const abort = new AbortController();
        setError(undefined);
        setDismissed(false);
        void client.commands["deployed.machines-list"]
          .query()
          .refresh(abort.signal)
          .then(
            (value) => {
              if (!abort.signal.aborted) setRows(value.rows);
            },
            (failure) => {
              if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : String(failure));
            },
          );
        return () => abort.abort();
      }, [client, refresh]);

      const openLaunch = async () => {
        setLaunching(true);
        setError(undefined);
        if (templates) return;
        try {
          const choices = await client.commands["deployed.template-choices"].query().refresh();
          setTemplates(choices);
          setTemplate(choices[0]?.value ?? "");
        } catch (failure) {
          setError(failure instanceof Error ? failure.message : String(failure));
        }
      };

      const launch = async () => {
        if (!template) return;
        setError(undefined);
        try {
          await client.commands["deployed.machine-launch"]({ template, name: name.trim() || undefined });
          setLaunching(false);
          setName("");
          setRefresh((value) => value + 1);
        } catch (failure) {
          setError(failure instanceof Error ? failure.message : String(failure));
        }
      };

      const stop = async (row: DeployedMachineRow) => {
        setError(undefined);
        try {
          await client.commands["deployed.machine-stop"]({ machineId: row.id, confirmed: true });
          setRefresh((value) => value + 1);
        } catch (failure) {
          setError(failure instanceof Error ? failure.message : String(failure));
          throw failure;
        }
      };

      const options = useMemo(() => deployedMachineFilterOptions(rows ?? []), [rows]);
      const visible = useMemo(() => filterDeployedMachines(rows ?? [], filters), [rows, filters]);
      const parent = controller ? { kind: "page" as const, page: deployedPageRef, resource: controller } : undefined;
      const createdAt = new Intl.DateTimeFormat(context.locale, { dateStyle: "medium", timeStyle: "short" });

      const open = (row: DeployedMachineRow) =>
        void client.navigation
          .open({
            kind: "page",
            page: deployedMachinePageRef,
            resource: row.resource,
            ...(parent ? { parent } : {}),
          })
          .catch((failure) => setError(failure instanceof Error ? failure.message : String(failure)));

      return (
        <Box h="100dvh" display="flex" flexDirection="column" minW="0" bg="bg" color="fg">
          <Stack p="md" gap="sm" flexShrink={0} borderBottomWidth="1px">
            <Flex justify="space-between" align="center" gap="sm" wrap="wrap">
              <Text textStyle="label/S/medium">{t("cloud-workspaces.machines", "Machines")}</Text>
              <HStack gap="xs">
                <Button size="xs" onClick={() => void openLaunch()}>
                  {t("cloud-workspaces.launch-workspace", "Launch workspace")}
                </Button>
                <Button size="xs" variant="ghost" onClick={() => setRefresh((value) => value + 1)}>
                  {t("cloud-workspaces.refresh", "Refresh")}
                </Button>
              </HStack>
            </Flex>
            {launching && (
              <HStack align="end" gap="xs" wrap="wrap">
                <Stack gap="2xs" minW="12rem">
                  <Text textStyle="label/XS" color="fg.muted">
                    {t("cloud-workspaces.template", "Template")}
                  </Text>
                  <NativeSelect.Root size="sm">
                    <NativeSelect.Field
                      value={template}
                      onChange={(event) => setTemplate(event.target.value)}
                      aria-label={t("cloud-workspaces.template", "Template")}
                    >
                      {(templates ?? []).map((choice) => (
                        <option key={choice.value} value={choice.value}>
                          {choice.label}
                        </option>
                      ))}
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                </Stack>
                <Stack gap="2xs" minW="12rem">
                  <Text textStyle="label/XS" color="fg.muted">
                    {t("cloud-workspaces.workspace-name", "Workspace name")}
                  </Text>
                  <Input
                    size="sm"
                    value={name}
                    placeholder={t("cloud-workspaces.workspace-name-optional", "Optional")}
                    onChange={(event) => setName(event.target.value)}
                  />
                </Stack>
                <Button size="sm" disabled={!template} onClick={() => void launch()}>
                  {t("cloud-workspaces.launch", "Launch")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setLaunching(false)}>
                  {t("cloud-workspaces.cancel", "Cancel")}
                </Button>
              </HStack>
            )}
            <HStack gap="sm" wrap="wrap">
              <FilterSelect
                label={t("cloud-workspaces.state", "State")}
                value={filters.state ?? ""}
                options={options.states.map(({ value, label }) => ({ value, label }))}
                onChange={(state) => setFilters((current) => ({ ...current, state: state || undefined }))}
              />
              <FilterSelect
                label={t("cloud-workspaces.reason", "Reason")}
                value={filters.reason ?? ""}
                options={options.reasons.map((value) => ({ value, label: value }))}
                onChange={(reason) => setFilters((current) => ({ ...current, reason: reason || undefined }))}
              />
              <FilterSelect
                label={t("cloud-workspaces.template", "Template")}
                value={filters.template ?? ""}
                options={options.templates.map((value) => ({ value, label: value }))}
                onChange={(template) => setFilters((current) => ({ ...current, template: template || undefined }))}
              />
            </HStack>
          </Stack>
          <ScrollArea flex="1" minH="0">
            <Stack p="md" gap="md">
              {error && !dismissed && (
                <MonitoringError
                  message={error}
                  t={t}
                  retry={() => setRefresh((value) => value + 1)}
                  dismiss={() => setDismissed(true)}
                />
              )}
              {!error && !rows && (
                <Text role="status" color="fg.muted">
                  {t("cloud-workspaces.monitoring-loading", "Loading workspace monitoring…")}
                </Text>
              )}
              {rows && visible.length === 0 && (
                <Text color="fg.muted">
                  {t("cloud-workspaces.monitoring-no-workspaces", "No workspaces match these filters.")}
                </Text>
              )}
              {visible.length > 0 && (
                <SimpleCard minW="0">
                  <SimpleCardBody>
                    <Box overflowX="auto">
                      <Table.Root size="sm" aria-label={t("cloud-workspaces.machines", "Machines")}>
                        <Table.Header>
                          <Table.Row>
                            <Table.ColumnHeader>{t("cloud-workspaces.workspace", "Workspace")}</Table.ColumnHeader>
                            <Table.ColumnHeader>{t("cloud-workspaces.template", "Template")}</Table.ColumnHeader>
                            <Table.ColumnHeader>{t("cloud-workspaces.state", "State")}</Table.ColumnHeader>
                            <Table.ColumnHeader>{t("cloud-workspaces.created-at", "Created at")}</Table.ColumnHeader>
                            <Table.ColumnHeader>{t("cloud-workspaces.reason", "Reason")}</Table.ColumnHeader>
                            <Table.ColumnHeader />
                          </Table.Row>
                        </Table.Header>
                        <Table.Body>
                          {visible.map((row) => (
                            <Table.Row key={row.id}>
                              <Table.Cell>
                                <Button variant="plain" size="sm" px="0" onClick={() => open(row)}>
                                  {row.name}
                                </Button>
                              </Table.Cell>
                              <Table.Cell>
                                {row.template}@{row.version}
                              </Table.Cell>
                              <Table.Cell>
                                <Chip>{row.status}</Chip>
                              </Table.Cell>
                              <Table.Cell whiteSpace="nowrap">{createdAt.format(new Date(row.createdAt))}</Table.Cell>
                              <Table.Cell>{row.reason || "—"}</Table.Cell>
                              <Table.Cell textAlign="end">
                                {row.canStop && (
                                  <Button size="xs" variant="outline" onClick={() => setPendingStop(row)}>
                                    {t("cloud-workspaces.shut-down-workspace", "Shut down")}
                                  </Button>
                                )}
                              </Table.Cell>
                            </Table.Row>
                          ))}
                        </Table.Body>
                      </Table.Root>
                    </Box>
                  </SimpleCardBody>
                </SimpleCard>
              )}
            </Stack>
          </ScrollArea>
          <DeleteConfirmationModal
            open={Boolean(pendingStop)}
            onClose={() => setPendingStop(undefined)}
            headline={t("cloud-workspaces.shut-down-workspace-title", "Shut down workspace?")}
            buttonText={t("cloud-workspaces.shut-down-workspace", "Shut down")}
            notificationText={t(
              "cloud-workspaces.shut-down-workspace-description",
              "This stops the workspace and any app or test running inside it.",
            )}
            onDelete={async () => {
              if (pendingStop) await stop(pendingStop);
            }}
          />
        </Box>
      );
    }

    root.render(
      <ChakraProvider value={psTheme}>
        <MachinesView />
      </ChakraProvider>,
    );
    return () => root.unmount();
  },
});
