import { resolveFileIconElement, useFileIconThemePreference } from "@pstdio/ui";
import { FileChangeBadge } from "@pstdio/ui/diff";

export const WorkspaceFileTreeIcon = (props: { name: string; directory: boolean }) => {
  const { name, directory } = props;
  const { activeFileIconTheme } = useFileIconThemePreference();
  return resolveFileIconElement(name, { isDirectory: directory, theme: activeFileIconTheme });
};

export const WorkspaceFileChangeBadge = (props: { change: string }) => {
  const { change } = props;
  return <FileChangeBadge change={change} />;
};
