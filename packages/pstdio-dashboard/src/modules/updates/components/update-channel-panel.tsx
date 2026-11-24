import { Stack, Text } from "@chakra-ui/react";
import { AlertMessage, SettingsContentSkeleton } from "@pstdio/ui";
import { ParamEditorRow, type ReadOnlyParam, type SelectionParam } from "@pstdio/ui/param-editor";
import { getWorkbenchOperations } from "@pstdio/workbench";
import { WORKBENCH_SETTINGS_OPEN_COMMAND_ID } from "@pstdio/workbench/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import type { UpdateChannel, UpdateChannelBridge } from "../update-channel-bridge";

import { changeUpdateChannel, projectUpdateChannel } from "../update-channel-operation";

const updateChannelQueryKey = ["desktop", "update-channel"];
const appInfoQueryKey = ["desktop", "app-info"];

interface UpdateChannelContentProps {
  /** `undefined` while the channel loads. */
  channel?: UpdateChannel;
  version?: string;
  saving?: boolean;
  error?: string;
  onChange: (channel: UpdateChannel) => void;
  onDismissError: () => void;
}

export const UpdateChannelContent = (props: UpdateChannelContentProps) => {
  const { channel, version, saving, error, onChange, onDismissError } = props;
  const { t } = useTranslation("settings");
  const channelParam: SelectionParam = {
    id: "channel",
    name: t("updates.channel"),
    type: "selection",
    defaultValue: channel ?? "",
    placeholder: t("updates.loading"),
    disabled: channel === undefined,
    options: [
      { id: "stable", name: t("updates.stable") },
      { id: "nightly", name: t("updates.nightly") },
    ],
  };
  const versionParam: ReadOnlyParam = {
    id: "version",
    name: t("updates.currentVersion"),
    type: "readOnly",
    value: version ?? null,
  };

  return (
    <Stack gap="md">
      {error ? <AlertMessage status="error" title={error} onClose={onDismissError} /> : null}
      <Stack gap="0">
        {channel === undefined && !error ? (
          <SettingsContentSkeleton />
        ) : (
          <ParamEditorRow
            param={channelParam}
            onChange={(_id, value) => {
              if (value === "stable" || value === "nightly") onChange(value);
            }}
          />
        )}
        {saving ? (
          <Text role="status" px="sm" textStyle="label/S/regular" color="fg.muted">
            {t("updates.saving", { defaultValue: "Saving…" })}
          </Text>
        ) : null}
        {channel && (
          <Stack gap="2xs" px="sm" pb="xs">
            <Text textStyle="label/S/regular" color="fg.muted">
              {channel === "nightly" ? t("updates.nightlyHelper") : t("updates.stableHelper")}
            </Text>
            {channel === "nightly" && (
              <Text textStyle="label/S/regular" color="fg.muted">
                {t("updates.switchBackNote")}
              </Text>
            )}
          </Stack>
        )}
        {version ? <ParamEditorRow param={versionParam} /> : null}
      </Stack>
    </Stack>
  );
};

interface UpdateChannelPanelProps {
  bridge: UpdateChannelBridge;
}

export const UpdateChannelPanel = (props: UpdateChannelPanelProps) => {
  const { bridge } = props;
  const { t } = useTranslation("settings");
  const queryClient = useQueryClient();
  const channel = useQuery({ queryKey: updateChannelQueryKey, queryFn: () => bridge.getUpdateChannel() });
  const appInfo = useQuery({ queryKey: appInfoQueryKey, queryFn: () => bridge.getAppInfo() });
  const operations = getWorkbenchOperations(getDashboardScopedQueries());
  const displayed = () => projectUpdateChannel(operations, channel.data);
  const selected = useSyncExternalStore(operations.subscribe, displayed, displayed);
  const change = useMutation({
    mutationFn: (next: UpdateChannel) =>
      changeUpdateChannel({
        operations,
        bridge,
        channel: next,
        sourceCommand: { id: WORKBENCH_SETTINGS_OPEN_COMMAND_ID, args: { panelId: "update-channel" } },
        async accept(confirmed, signal) {
          await queryClient.cancelQueries({ queryKey: updateChannelQueryKey });
          signal.throwIfAborted();
          queryClient.setQueryData(updateChannelQueryKey, confirmed);
        },
      }),
  });

  return (
    <UpdateChannelContent
      channel={selected ?? undefined}
      version={appInfo.data?.version}
      saving={change.isPending}
      error={change.isError ? t("updates.saveError") : undefined}
      onChange={(next) => change.mutate(next)}
      onDismissError={() => change.reset()}
    />
  );
};
