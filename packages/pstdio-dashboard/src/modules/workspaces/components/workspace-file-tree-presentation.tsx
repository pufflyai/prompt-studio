import { resolveFileIconElement, useFileIconThemePreference } from "@pstdio/ui";

export const WorkspaceFileTreeIcon = (props: { name: string }) => {
  const { name } = props;
  const { activeFileIconTheme } = useFileIconThemePreference();
  return resolveFileIconElement(name, { theme: activeFileIconTheme });
};
