import { CloseButton } from "@chakra-ui/react";
import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import { ScopedDialog as Dialog, LoadingState } from "@pstdio/ui";
import { KanbanRendererCreateDialog } from "@pstdio/ui/kanban-renderer";
import { useEffect, useState } from "react";
import type { RegisteredKanbanRendererContribution, ResourceRef, WorkbenchCore } from "../../core";
import { bindKanbanRendererContribution } from "../../core/registries/renderers/kanban-renderer-binding";
import type { ReactRegisteredKanbanRendererContribution } from "../renderers/kanban/kanban-presentation";
import { useKanbanAttributes } from "../renderers/kanban/use-kanban-attributes";
import { RendererReadNotice } from "../renderers/renderer-read-notice";
import { useOperationAuthority } from "../shared/use-operation-authority";

interface RendererCreateDialogProps {
  contribution: RegisteredKanbanRendererContribution;
  workbench: WorkbenchCore;
  /** The resource the create command was invoked for; its board reads and writes that resource. */
  resource?: ResourceRef;
  placement?: PlacementIdentity;
  onClose(): void;
}

export const RendererCreateDialog = (props: RendererCreateDialogProps) => {
  const { onClose } = props;
  const { workbench } = props;
  const draftAuthority = useOperationAuthority(workbench);
  const [canOpenCreatedRow] = useState(() => {
    const { location, activePageId, projectId } = workbench.pages.store.getState();
    const placement = props.placement ?? workbench.pages.getContent()?.placementIdentity;
    const viewer = workbench.viewers.captureContext(placement);
    return () => {
      const current = workbench.pages.store.getState();
      return (
        current.location === location &&
        current.activePageId === activePageId &&
        current.projectId === projectId &&
        viewer.isViewerCurrent?.() !== false
      );
    };
  });
  const contribution = bindKanbanRendererContribution(props.contribution as ReactRegisteredKanbanRendererContribution, {
    instanceId: "create-dialog",
    resource: props.resource,
  });
  const attributes = useKanbanAttributes(contribution.attributes);
  const [read, setRead] = useState<{ ready: boolean; error?: string }>({ ready: false });
  const [revision, setRevision] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Retry starts a fresh metadata read.
  useEffect(() => {
    const controller = new AbortController();
    const state = {
      settings: {
        viewMode: "board" as const,
        columnGrouping: "none",
        rowGrouping: "none",
        displayProperties: [],
        ...contribution.defaultSettings,
      },
      filter: contribution.defaultFilter ?? { conjunction: "and" as const, rules: [] },
      sorts: contribution.defaultSorts ?? [],
    };
    // The query supplies live property definitions even when the board is not mounted.
    const load = contribution.executePage
      ? contribution.executePage({ ...state, page: { offset: 0, limit: 1, fields: [], search: "" } }, controller.signal)
      : contribution.executeQuery(state, controller.signal);
    Promise.resolve(load).then(
      () => {
        if (!controller.signal.aborted) setRead({ ready: true });
      },
      (error) => {
        if (!controller.signal.aborted) setRead({ ready: false, error: String(error) });
      },
    );
    return () => controller.abort();
  }, [contribution, revision]);
  if (read.ready)
    return (
      <KanbanRendererCreateDialog
        open
        columnId=""
        attributes={attributes}
        config={contribution.createRow!}
        key={draftAuthority}
        draftKey={JSON.stringify([contribution.id, contribution.storageScope, draftAuthority, "create"])}
        filter={contribution.defaultFilter}
        onClose={onClose}
        onSubmit={(submission) => contribution.onCreateRow!({ ...submission, canOpenCreatedRow })}
      />
    );
  return (
    <Dialog.Root open size="lg" onOpenChange={(details) => !details.open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>{contribution.createRow!.title}</Dialog.Title>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Header>
          <Dialog.Body>
            {read.error ? (
              <RendererReadNotice
                error={read.error}
                initial
                retry={() => {
                  setRead({ ready: false });
                  setRevision(revision + 1);
                }}
              />
            ) : (
              <LoadingState />
            )}
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};
