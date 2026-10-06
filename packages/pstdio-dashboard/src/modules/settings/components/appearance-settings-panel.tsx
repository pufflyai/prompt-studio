import { Stack, Text } from "@chakra-ui/react";
import { useThemePreference } from "@pstdio/ui";
import { ParamEditorRow, type SelectionParam } from "@pstdio/ui/param-editor";
import { useTranslation } from "react-i18next";

// Lists every registered theme, light themes first, like the Change Theme picker.
export const AppearanceSettingsPanel = () => {
  const { t } = useTranslation("settings");
  const { chosenThemePreference, themePreferences, setThemePreference } = useThemePreference();
  const themes = [...themePreferences].sort((a, b) => {
    if (a.mode !== b.mode) return a.mode === "light" ? -1 : 1;
    return (a.title ?? a.id).localeCompare(b.title ?? b.id);
  });
  const themeParam: SelectionParam = {
    id: "theme",
    name: t("appearance.theme"),
    description: t("appearance.themeHelper"),
    type: "selection",
    defaultValue: chosenThemePreference,
    options: themes.map((theme) => ({ id: theme.id, name: theme.title ?? theme.id })),
    searchable: themes.length > 5,
  };

  return (
    <Stack gap="md" padding="lg" maxW="720px">
      <Stack gap="2xs">
        <Text textStyle="heading/S">{t("appearance.title")}</Text>
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          {t("appearance.description")}
        </Text>
      </Stack>
      <Stack gap="0" borderWidth="1px" borderColor="border.subtle" borderRadius="md" py="xs">
        <ParamEditorRow
          param={themeParam}
          onChange={(_id, value) => {
            if (typeof value === "string") setThemePreference(value);
          }}
        />
      </Stack>
    </Stack>
  );
};
