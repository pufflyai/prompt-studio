import { HStack, Stack, Table, Text } from "@chakra-ui/react";
import { type DeviceLogin, type TeamAccount, type TeamExtensionPolicy, viewDataEvents } from "@pstdio/sdk/extensions";
import { useWebviewCommandQuery, useWebviewVisibility } from "@pstdio/sdk/extensions/react";
import { Checkbox, SettingsPage } from "@pstdio/ui";
import { type ReactNode, useRef, useState } from "react";
import { Button } from "./button";
import { useCloudContext } from "./cloud-context";
import { CloudError } from "./cloud-error";
import { CloudIcon } from "./cloud-label";
import type { cloudCommands } from "./project-state";
import { useTeamQuery } from "./team-query";

type Source = Awaited<ReturnType<(typeof cloudCommands)["extension-sources"]["run"]>>[number];
interface ManagedRow {
  extensionId: string;
  name: string;
  version?: string | null;
  icon?: string;
  source?: Source;
  decision?: TeamExtensionPolicy;
}
interface ManagedExtensionsProps {
  team: TeamAccount;
  login: DeviceLogin;
  projectId?: string;
  selection?: ReactNode;
}

export const ManagedExtensions = (props: ManagedExtensionsProps) => {
  const { team, login, projectId, selection } = props;
  const { client, t } = useCloudContext();
  const expected = { accountId: login.accountId, managerOrigin: login.managerOrigin };
  const visible = useWebviewVisibility();
  const policy = useTeamQuery({ op: "extensionPolicy", accountId: team.accountId }, login);
  const sources = useWebviewCommandQuery(
    client.commands["extension-sources"].query(undefined, {
      events: [viewDataEvents.extensionCatalogChanged],
    }),
    visible && !!projectId,
  );
  const [busy, setBusy] = useState<string>();
  const working = useRef(false);
  const [error, setError] = useState<string>();
  const rows = new Map<string, ManagedRow>();
  for (const source of sources.data ?? []) rows.set(source.extensionId, { ...source, source });
  for (const decision of policy.data ?? []) {
    const row = rows.get(decision.extensionId);
    if (decision.required) rows.set(decision.extensionId, { ...row, ...decision.required, decision });
    else if (row) row.decision = decision;
  }
  const refresh = () => {
    policy.refresh();
    if (projectId) sources.refresh();
  };
  const change = async (row: ManagedRow, managed: boolean) => {
    if (working.current) return;
    if (managed && (!row.source || !projectId)) return;
    if (!managed && !row.decision?.required) return;
    working.current = true;
    setBusy(row.extensionId);
    setError(undefined);
    try {
      if (managed) await publish(row);
      else if (row.decision)
        await client.account.writeTeamMembership(
          {
            op: "unmanageExtension",
            accountId: team.accountId,
            extensionId: row.extensionId,
            expectedSelection: row.decision.selectionId,
          },
          expected,
        );
      refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      policy.refresh();
    } finally {
      working.current = false;
      setBusy(undefined);
    }
  };
  const publish = async (row: ManagedRow) => {
    if (row.source && projectId)
      await client.account.writeTeamMembership(
        {
          op: "manageExtension",
          accountId: team.accountId,
          projectId,
          instanceId: row.source.instanceId,
          expectedSelection: row.decision?.selectionId ?? null,
        },
        expected,
      );
  };
  return (
    <SettingsPage
      title={t("managed.title", "Managed extensions")}
      icon={<CloudIcon name="package-check" />}
      description={
        <Stack gap="sm">
          {selection}
          <Text color="fg.muted">
            {t(
              "managed.description",
              "Selected extensions are installed automatically in team projects. Only the team owner can change them.",
            )}
          </Text>
        </Stack>
      }
    >
      {policy.loading ? (
        <Text role="status">{t("managed.loading", "Loading managed extensions…")}</Text>
      ) : (
        <ManagedExtensionRows
          rows={[...rows.values()].sort((a, b) => a.name.localeCompare(b.name))}
          owner={team.role === "owner"}
          busy={busy}
          ready={policy.data !== undefined && !policy.error}
          change={(row, managed) => void change(row, managed)}
        />
      )}
      {team.role === "owner" && !projectId && (
        <Text color="fg.muted">{t("managed.openProject", "Open a project to choose an installed extension.")}</Text>
      )}
      {busy && <Text role="status">{t("managed.saving", "Updating team policy…")}</Text>}
      {(error ?? policy.error?.message ?? sources.error?.message) && (
        <CloudError
          inline
          message={(error ?? policy.error?.message ?? sources.error?.message)!}
          onClose={error ? () => setError(undefined) : undefined}
          action={
            <Button size="sm" disabled={!!busy} onClick={refresh}>
              {t("actions.retry", "Retry")}
            </Button>
          }
        />
      )}
    </SettingsPage>
  );
};

export const ManagedExtensionRows = (props: {
  rows: ManagedRow[];
  owner: boolean;
  ready: boolean;
  busy?: string;
  change: (row: ManagedRow, managed: boolean) => void;
}) => {
  const { rows, owner, ready, busy, change } = props;
  const { t } = useCloudContext();
  return (
    <Table.Root size="sm" variant="line">
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeader>{t("managed.extension", "Extension")}</Table.ColumnHeader>
          <Table.ColumnHeader>{t("managed.version", "Version")}</Table.ColumnHeader>
          <Table.ColumnHeader textAlign="end">{t("managed.managed", "Managed")}</Table.ColumnHeader>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {rows.map((row) => (
          <Table.Row key={row.extensionId}>
            <Table.Cell py="sm">
              <HStack gap="sm">
                <CloudIcon name={row.icon ?? "package"} />
                <Stack gap="0" minW="0">
                  <Text textStyle="label/M/medium" truncate>
                    {row.name}
                  </Text>
                  <Text color="fg.muted" textStyle="label/S/regular">
                    {row.extensionId.split(".")[0]}
                  </Text>
                  {owner && row.source && row.decision?.required && (
                    <Button
                      variant="ghost"
                      size="xs"
                      alignSelf="start"
                      disabled={!!busy || !ready}
                      onClick={() => change(row, true)}
                    >
                      {t("managed.updateFromProject", "Update from this project")}
                    </Button>
                  )}
                </Stack>
              </HStack>
            </Table.Cell>
            <Table.Cell color="fg.muted">{row.version ?? "—"}</Table.Cell>
            <Table.Cell textAlign="end">
              <Checkbox
                inputProps={{ "aria-label": t("managed.manageNamed", "Manage {{name}}", { name: row.name }) }}
                checked={!!row.decision?.required}
                disabled={!owner || !!busy || !ready || (!row.source && !row.decision?.required)}
                onCheckedChange={({ checked }) => change(row, checked === true)}
              />
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
};
