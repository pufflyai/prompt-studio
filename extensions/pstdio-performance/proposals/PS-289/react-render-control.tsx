import { Stack, Text } from "@chakra-ui/react";
import { Switch } from "@pstdio/ui";
import { useTranslations } from "../../src/translations";

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
        aria-busy={pending}
        onCheckedChange={({ checked }) => onEnabledChange(checked)}
      >
        {t("reactScan.highlight", "Highlight React renders")}
      </Switch>
      {!state?.supported ? (
        <Text textStyle="label/S/regular" color="fg.muted">
          {t("reactScan.unavailable", "React Scan is unavailable in this build.")}
        </Text>
      ) : null}
    </Stack>
  );
};
