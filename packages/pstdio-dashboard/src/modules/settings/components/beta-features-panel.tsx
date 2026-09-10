import { Button, Stack, Text } from "@chakra-ui/react";
import { Switch } from "@pstdio/ui";
import { useTranslation } from "react-i18next";
import { useSettings, useUpdateSettings } from "../data/use-settings";

interface BetaFeaturesContentProps {
  enabled?: boolean;
  saving?: boolean;
  error?: string;
  onChange: (enabled: boolean) => void;
  onRetry: () => void;
}

export const BetaFeaturesContent = (props: BetaFeaturesContentProps) => {
  const { enabled, saving, error, onChange, onRetry } = props;
  const { t } = useTranslation("settings");
  return (
    <Stack gap="md" padding="lg">
      <Stack gap="2xs">
        <Text textStyle="heading/S">{t("betaFeatures.title")}</Text>
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          {t("betaFeatures.description")}
        </Text>
      </Stack>
      <Switch
        checked={enabled === true}
        inputProps={{ checked: enabled === true }}
        disabled={enabled === undefined || saving}
        onCheckedChange={({ checked }) => onChange(checked)}
      >
        {t("betaFeatures.notifications")}
      </Switch>
      {enabled === undefined && !error ? <Text color="fg.muted">{t("betaFeatures.loading")}</Text> : null}
      {error ? (
        <Stack gap="sm" role="alert">
          <Text color="fg.error">{error}</Text>
          <Button variant="outline" alignSelf="start" onClick={onRetry}>
            {t("runtimeSettings.retry")}
          </Button>
        </Stack>
      ) : null}
    </Stack>
  );
};

export const BetaFeaturesPanel = () => {
  const { data, error, refetch } = useSettings();
  const update = useUpdateSettings();
  return (
    <BetaFeaturesContent
      enabled={data?.notifications_enabled}
      saving={update.isPending}
      error={(update.error ?? error)?.message}
      onChange={(notifications_enabled) => update.mutate({ notifications_enabled })}
      onRetry={() => {
        update.reset();
        void refetch();
      }}
    />
  );
};
