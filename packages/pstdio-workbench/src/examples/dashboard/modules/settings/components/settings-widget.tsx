import { Box } from "@chakra-ui/react";
import { WebviewPlaceholder } from "../../../shared/components/webview-placeholder";

interface SettingsWidgetProps {
  title: string;
  contributor: string;
  entry: string;
  icon: string;
}

export const SettingsWidget = (props: SettingsWidgetProps) => {
  const { title, contributor, entry, icon } = props;

  return (
    <Box h="full" minH="0" p="md">
      <WebviewPlaceholder
        slotId="project.settingsPanels.webview"
        title={title}
        contributor={contributor}
        entry={entry}
        icon={icon}
        height="100%"
      />
    </Box>
  );
};
