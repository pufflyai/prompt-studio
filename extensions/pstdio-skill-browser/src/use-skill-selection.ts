import type { NavigationTarget } from "@pstdio/sdk/extensions";
import type { Skill } from "@pstdio/sdk/resources";
import { useEffect, useRef, useState } from "react";

interface Navigation {
  open(target: NavigationTarget): Promise<void>;
}

export const useSkillSelection = (
  navigation: Navigation,
  skill: Pick<Skill, "name" | "title" | "project_id"> | null | undefined,
  active: boolean,
) => {
  const [error, setError] = useState<unknown>();
  const retry = useRef(() => {});
  useEffect(() => {
    let current = true;
    const select = () => {
      if (!active || !skill) return;
      setError(undefined);
      void navigation
        .open({
          kind: "page",
          page: { kind: "page", extensionId: "pstdio.pstdio-skill-browser", id: "skill" },
          resource: {
            type: "skill",
            id: skill.name,
            label: skill.title || skill.name,
            projectId: skill.project_id,
            extensionId: "pstdio.pstdio-skill-browser",
          },
        })
        .catch((error) => {
          if (current) setError(error);
        });
    };
    retry.current = select;
    select();
    return () => {
      current = false;
      retry.current = () => {};
    };
  }, [navigation, active, skill]);
  return { error, retry: () => retry.current() };
};
