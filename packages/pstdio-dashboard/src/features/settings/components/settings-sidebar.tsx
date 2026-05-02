import { Sidebar, type TreeListNavigateEvent, type TreeListSection } from "@pstdio/ui";
import { Terminal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BackToProjects } from "./back-to-projects";

export type GlobalSettingsSection = "agents";

export const GLOBAL_SETTINGS_SIDEBAR_STORAGE_KEY = "global-settings-sidebar";

interface SettingsSidebarProps {
  activeSection: GlobalSettingsSection;
  onSelectSection: (section: GlobalSettingsSection) => void;
}

const sections = (label: string): TreeListSection[] => [
  {
    id: "global",
    nodes: [
      {
        id: "agents",
        label,
        icon: <Terminal size={14} />,
        isNavigable: true,
        navigationIntent: { id: "select", payload: "agents" },
      },
    ],
  },
];

export const SettingsSidebar = (props: SettingsSidebarProps) => {
  const { t } = useTranslation("settings");
  const { activeSection, onSelectSection } = props;

  const handleNavigate = (event: TreeListNavigateEvent) => {
    const intent = event.intent;
    if (!intent || intent.id !== "select") {
      return;
    }

    onSelectSection("agents");
  };

  return (
    <Sidebar
      storageKey={GLOBAL_SETTINGS_SIDEBAR_STORAGE_KEY}
      sections={sections(t("agentList.agents"))}
      activeNodeId={activeSection}
      header={<BackToProjects />}
      onNavigate={handleNavigate}
      closable={false}
      width="240px"
    />
  );
};
