import { Button, Text } from "@chakra-ui/react";
import type { ExtensionViewRenderContext, NavigationTarget, TreeNode } from "@pstdio/sdk/extensions";
import type { Skill } from "@pstdio/sdk/resources";
import {
  resolveFileIconElement,
  ScrollArea,
  TreeList,
  type TreeListNode,
  useFileIconThemePreference,
} from "@pstdio/ui";
import { ParamEditor } from "@pstdio/ui/param-editor";
import { useEffect, useState } from "react";
import { selectedSkillFile, skillFiles, skillInfo } from "./skill-content";

interface SkillMenuProps {
  skill: Skill;
  path: unknown;
  navigation: { open(target: NavigationTarget): Promise<void> };
  t: ExtensionViewRenderContext["t"];
}
const ancestorIds = (path?: string) =>
  path
    ?.split("/")
    .slice(0, -1)
    .map((_, index, parts) => `dir:${parts.slice(0, index + 1).join("/")}`) ?? [];

export const SkillMenu = (props: SkillMenuProps) => {
  const { skill, path, navigation, t } = props;
  const selectedFile = selectedSkillFile(skill, path);
  const selectedPath = selectedFile?.path;
  const [expandedSections, setExpandedSections] = useState(["files"]);
  const [expandedNodes, setExpandedNodes] = useState<string[]>(() => ancestorIds(selectedPath));
  const [error, setError] = useState<unknown>();
  const { activeFileIconTheme } = useFileIconThemePreference();
  useEffect(() => {
    setExpandedNodes((current) => [...new Set([...current, ...ancestorIds(selectedPath)])]);
  }, [selectedPath]);
  const target = (file: string): NavigationTarget => ({
    kind: "page",
    page: { kind: "page", extensionId: "pstdio.pstdio-skill-browser", id: "skill" },
    resource: {
      type: "skill",
      id: skill.id,
      label: skill.title || skill.name,
      projectId: skill.project_id,
      extensionId: "pstdio.pstdio-skill-browser",
    },
    params: { file },
  });
  const open = async (target: NavigationTarget) => {
    setError(undefined);
    try {
      await navigation.open(target);
    } catch (error) {
      setError(error);
    }
  };
  const nodes = (items: TreeNode[]): TreeListNode[] =>
    items.map((item) => ({
      id: item.id,
      label: String(item.label),
      icon: item.fileName ? resolveFileIconElement(item.fileName, { theme: activeFileIconTheme }) : undefined,
      isContainer: Boolean(item.children),
      children: item.children && nodes(item.children),
      onActivate: item.target ? () => void open(item.target!) : undefined,
    }));
  const toggle = (ids: string[], id: string) => (ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]);
  return (
    <ScrollArea h="full" minH="0" minW="0">
      <ParamEditor groups={[skillInfo(skill, t)]} readOnly fullWidth />
      {error ? (
        <>
          <Text role="alert">{String(error)}</Text>
          <Button onClick={() => setError(undefined)}>{t("actions.dismiss", "Dismiss")}</Button>
        </>
      ) : null}
      <TreeList
        sections={[
          {
            id: "files",
            label: t("skill.files", "Files"),
            nodes: nodes(skillFiles(skill, selectedFile?.path, target)),
          },
        ]}
        activeNodeId={selectedFile?.path}
        expandedSectionIds={expandedSections}
        expandedNodeIds={expandedNodes}
        onToggleSection={(id) => setExpandedSections((ids) => toggle(ids, id))}
        onToggleNode={(id) => setExpandedNodes((ids) => toggle(ids, id))}
      />
    </ScrollArea>
  );
};
