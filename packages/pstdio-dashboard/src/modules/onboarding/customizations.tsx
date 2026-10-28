import { HStack, Stack, Text } from "@chakra-ui/react";
import { AlertMessage, Switch } from "@pstdio/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getApiClient } from "@/lib/api";

interface CustomizationsContentProps {
  hidden?: boolean;
  saving?: boolean;
  error?: string;
  onChange: (hidden: boolean) => void;
}
export const CustomizationsContent = (props: CustomizationsContentProps) => {
  const { hidden, saving, error, onChange } = props;
  const { t } = useTranslation("common");
  return (
    <Stack gap="md" padding="lg" maxW="chat-content">
      <Text textStyle="heading/S">{t("onboarding.customizations")}</Text>
      <HStack gap="sm" padding="md" borderWidth="1px" borderColor="border.subtle" borderRadius="md">
        <Text textStyle="label/S/medium" flex="1">
          {t("onboarding.dontShow")}
        </Text>
        <Switch
          checked={hidden === true}
          disabled={hidden === undefined || saving}
          inputProps={{ checked: hidden === true, "aria-label": t("onboarding.dontShow") }}
          onCheckedChange={({ checked }) => onChange(checked)}
        />
      </HStack>
      {error && (
        <AlertMessage status="error" title={t("onboarding.saveError")}>
          {error}
        </AlertMessage>
      )}
    </Stack>
  );
};
export const Customizations = () => {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["onboarding"], queryFn: () => getApiClient().onboarding.read() });
  const mutation = useMutation({
    mutationFn: (hidden: boolean) => getApiClient().onboarding.update({ step: "visibility", hidden }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["onboarding"] }),
  });
  return (
    <CustomizationsContent
      hidden={query.data?.state.hidden}
      saving={mutation.isPending}
      error={(mutation.error ?? query.error)?.message}
      onChange={(hidden) => mutation.mutate(hidden)}
    />
  );
};
