import { Text } from "@chakra-ui/react";
import { Header, resolveFileIconElement, useFileIconThemePreference } from "@pstdio/ui";

export const FileRendererPathHeader = (props: {
  fileName: string;
  filePath: string;
  dirty?: boolean;
  saving?: boolean;
}) => {
  const { fileName, filePath, dirty, saving } = props;
  const { activeFileIconTheme } = useFileIconThemePreference();

  return (
    <Header variant="narrow" flexShrink={0} gap="2xs" bg="bg">
      {resolveFileIconElement(fileName, { theme: activeFileIconTheme })}
      <Text aria-label={`File path ${filePath}`} textStyle="label/S/regular" color="fg.muted" truncate>
        {filePath}
      </Text>
      {dirty && (
        <Text
          role="status"
          aria-label={saving ? "Saving file" : "Unsaved changes"}
          title={saving ? "Saving…" : "Unsaved changes (⌘S / Ctrl+S)"}
          textStyle="label/S/regular"
          color="fg.muted"
        >
          {saving ? "Saving…" : "●"}
        </Text>
      )}
    </Header>
  );
};
