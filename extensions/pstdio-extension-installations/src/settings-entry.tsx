import { HStack, Stack, Text } from "@chakra-ui/react";
import { AlertMessage, SimpleCard, SimpleCardBody, Switch } from "@pstdio/ui";
import { useEffect, useState } from "react";
import { createInstallationView, type ViewProps } from "./create-view";
import { visibilitySetting } from "./settings";

const Settings = (props: ViewProps) => {
  const { client, t } = props;
  const [enabled, setEnabled] = useState<boolean>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    client.preferences.get(visibilitySetting, { scope: "user" }).then(
      (value) => {
        if (active) setEnabled(value !== false);
      },
      (cause) => {
        if (active) setError(String(cause));
      },
    );
    return () => {
      active = false;
    };
  }, [client]);
  const change = async (value: boolean) => {
    setSaving(true);
    setError(undefined);
    try {
      await client.preferences.set(visibilitySetting, value, { scope: "user" });
      setEnabled(value);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Stack gap="md" p="lg">
      {error && <AlertMessage status="error" title={error} />}
      <SimpleCard>
        <SimpleCardBody>
          <HStack gap="sm" alignItems="center">
            <Text textStyle="label/S/medium" flex="1">
              {t("installations.title")}
            </Text>
            <Switch
              checked={enabled === true}
              inputProps={{ checked: enabled === true, "aria-label": t("installations.title") }}
              disabled={enabled === undefined || saving}
              onCheckedChange={({ checked }) => void change(checked)}
            />
          </HStack>
        </SimpleCardBody>
      </SimpleCard>
    </Stack>
  );
};
export default createInstallationView(Settings);
