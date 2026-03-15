import { useMutation } from "@tanstack/react-query";
import { clearProjectStartupScript, setProjectStartupScript } from "@/features/project/data/api";

export const useSaveProjectStartupScript = (projectId: string | undefined) =>
  useMutation({
    mutationFn: async (script: string) => {
      if (!projectId) throw new Error("Project id is required.");

      if (script.trim().length === 0) {
        await clearProjectStartupScript(projectId);
        return;
      }

      await setProjectStartupScript(projectId, script);
    },
  });
