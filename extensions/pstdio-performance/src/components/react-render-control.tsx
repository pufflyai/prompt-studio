import { Stack, Text } from "@chakra-ui/react";
import { Switch } from "@pstdio/ui";
import { useTranslations } from "../translations";

export interface ReactRenderControlProps {
  state?: { supported: boolean; enabled: boolean; scope: "workbench" };
  pending?: boolean;
  onEnabledChange(enabled: boolean): void;
}

export const ReactRenderControl = (props: ReactRenderControlProps) => {
  const { state, pending, onEnabledChange } = props;
  const { t } = useTranslations();
  return (
    <Stack gap="xs">
      <Switch
        size="sm"
        checked={state?.enabled ?? false}
        disabled={!state?.supported || pending}
        onCheckedChange={({ checked }) => onEnabledChange(checked)}
      >
        {t("reactScan.highlight", "Highlight React renders")}
      </Switch>
      <Text textStyle="label/S/regular" color="fg.muted">
        {state?.supported
          ? t("reactScan.workbenchOnly", "Workbench only")
          : t("reactScan.unavailable", "React Scan is unavailable in this build.")}
      </Text>
    </Stack>
  );
};
