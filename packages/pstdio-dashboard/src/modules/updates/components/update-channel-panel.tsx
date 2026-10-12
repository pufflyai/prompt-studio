import { Stack, Text } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";
import { ParamEditorRow, type ReadOnlyParam, type SelectionParam } from "@pstdio/ui/param-editor";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { UpdateChannel, UpdateChannelBridge } from "../update-channel-bridge";

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
    disabled: channel === undefined || saving,
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
    <Stack gap="md" padding="lg" maxW="720px">
      <Stack gap="2xs">
        <Text textStyle="heading/S">{t("updates.title")}</Text>
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          {t("updates.description")}
        </Text>
      </Stack>
      {error ? <AlertMessage status="error" title={error} onClose={onDismissError} /> : null}
      <Stack gap="0" borderWidth="1px" borderColor="border.subtle" borderRadius="md" py="xs">
        <ParamEditorRow
          param={channelParam}
          onChange={(_id, value) => {
            if (value === "stable" || value === "nightly") onChange(value);
          }}
        />
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
  // Shows the new channel at once and restores the previous one if the desktop rejects it.
  const change = useMutation({
    mutationFn: (next: UpdateChannel) => bridge.setUpdateChannel(next),
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: updateChannelQueryKey });
      const previous = queryClient.getQueryData<UpdateChannel | null>(updateChannelQueryKey);
      queryClient.setQueryData(updateChannelQueryKey, next);
      return { previous };
    },
    onError: (_error, _next, result) => queryClient.setQueryData(updateChannelQueryKey, result?.previous),
  });

  return (
    <UpdateChannelContent
      channel={channel.data ?? undefined}
      version={appInfo.data?.version}
      saving={change.isPending}
      error={change.isError ? t("updates.saveError") : undefined}
      onChange={(next) => change.mutate(next)}
      onDismissError={() => change.reset()}
    />
  );
};
