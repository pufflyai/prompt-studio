import { Sidebar, type TreeListNavigateEvent, type TreeListSection } from "@pstdio/ui";
import { Gauge, Terminal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BackToProjects } from "./back-to-projects";

export type GlobalSettingsSection = "runtime" | "agents";

export const GLOBAL_SETTINGS_SIDEBAR_STORAGE_KEY = "global-settings-sidebar";

interface SettingsSidebarProps {
  activeSection: GlobalSettingsSection;
  onSelectSection: (section: GlobalSettingsSection) => void;
}

const sections = (labels: { runtime: string; agents: string }): TreeListSection[] => [
  {
    id: "global",
    nodes: [
      {
        id: "runtime",
        label: labels.runtime,
        icon: <Gauge size={14} />,
        isNavigable: true,
        navigationIntent: { id: "select", payload: "runtime" },
      },
      {
        id: "agents",
        label: labels.agents,
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

    if (intent.payload === "runtime" || intent.payload === "agents") {
      onSelectSection(intent.payload);
    }
  };

  return (
    <Sidebar
      storageKey={GLOBAL_SETTINGS_SIDEBAR_STORAGE_KEY}
      sections={sections({ runtime: t("runtimeSettings.navLabel"), agents: t("agentList.agents") })}
      activeNodeId={activeSection}
      header={<BackToProjects />}
      onNavigate={handleNavigate}
      closable={false}
      width="240px"
    />
  );
};
