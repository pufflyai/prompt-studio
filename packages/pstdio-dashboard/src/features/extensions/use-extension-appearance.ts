import type { ThemePreferenceOption } from "@pstdio/ui";
import { useQuery } from "@tanstack/react-query";
import type { ListExtensionAppearanceResponse } from "pstdio-api-contracts";
import { apiRequest } from "@/lib/api";

export const extensionAppearanceQueryKey = (projectId: string | undefined) => ["extensions", projectId, "appearance"];

export const useExtensionAppearanceThemePreferences = (projectId: string | undefined) => {
  const { data } = useQuery({
    queryKey: extensionAppearanceQueryKey(projectId),
    enabled: Boolean(projectId),
    queryFn: () =>
      apiRequest<ListExtensionAppearanceResponse>(`/v1/projects/${projectId}/extensions/appearance`).then(
        (appearance) => appearance.themes,
      ),
  });

  return (data ?? []).map(
    (theme) =>
      ({
        id: theme.id,
        title: theme.title,
        mode: theme.mode,
        tokens: theme.tokens,
        monacoTheme: theme.monacoTheme,
      }) satisfies ThemePreferenceOption,
  );
};
