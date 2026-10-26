import { Dialog } from "@chakra-ui/react";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { useWorkbenchStore } from "@pstdio/workbench/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getApiClient } from "@/lib/api";
import { dashboardSelectedProjectIdContextKey } from "@/shared/app/project-context";
import { FolderPicker } from "@/shared/filesystem/folder-picker";
import { findDashboardProject } from "../data/project-data";
import { ProjectFolderChoice, type ProjectFolderMethod } from "./project-folder-choice";

// `git@github.com:acme/notes.git` and `https://example.test/acme/notes` both clone into `notes`.
const repositoryName = (remote: string) =>
  remote
    .replace(/\.git$/, "")
    .split(/[/:]/)
    .filter(Boolean)
    .pop() ?? "project";

export const ProjectFolderWidget = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  const projectId = useWorkbenchStore(
    input.workbench.context.store,
    (state) => state.values[dashboardSelectedProjectIdContextKey],
  ) as string | undefined;
  const [method, setMethod] = useState<ProjectFolderMethod>();
  const [clonePath, setClonePath] = useState<string>();
  const [browsing, setBrowsing] = useState<"clone" | "existing">();
  const folder = useQuery({
    queryKey: ["project-folder", projectId],
    queryFn: () => getApiClient().projects.folder(projectId!),
    enabled: Boolean(projectId),
  });
  const close = () => input.workbench.layout.removeWidgetPlacement(input.instance.instanceId);
  const choose = useMutation({
    mutationFn: (choice: { path: string; clone: boolean }) => getApiClient().projects.chooseFolder(projectId!, choice),
    onSuccess: close,
  });
  if (!projectId || !folder.data) return null;
  const { gitRemote } = folder.data;
  const activeMethod = method ?? (gitRemote ? "clone" : "existing");
  const target = clonePath ?? (gitRemote ? `~/Projects/${repositoryName(gitRemote)}` : "");
  const chooseFolder = async (path: string, clone: boolean) => {
    try {
      await choose.mutateAsync({ path, clone });
    } catch {
      /* The dialog shows the server error and allows another try. */
    }
  };
  const pickFolder = async (path: string) => {
    setBrowsing(undefined);
    if (browsing === "clone") setClonePath(`${path.replace(/[/\\]+$/, "")}/${repositoryName(gitRemote ?? "")}`);
    else await chooseFolder(path, false);
  };
  return (
    <>
      <ProjectFolderChoice
        projectName={findDashboardProject(projectId)?.name ?? ""}
        gitRemote={gitRemote}
        method={activeMethod}
        clonePath={target}
        pending={choose.isPending}
        error={choose.error?.message}
        onMethodChange={setMethod}
        onClonePathChange={setClonePath}
        onBrowse={() => setBrowsing("clone")}
        onNotNow={close}
        onContinue={() => (activeMethod === "clone" ? void chooseFolder(target, true) : setBrowsing("existing"))}
      />
      <Dialog.Root
        open={browsing !== undefined}
        onOpenChange={(event) => {
          if (!event.open) setBrowsing(undefined);
        }}
        closeOnInteractOutside={false}
        lazyMount
        unmountOnExit
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <FolderPicker onClose={() => setBrowsing(undefined)} onSelect={pickFolder} />
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </>
  );
};
