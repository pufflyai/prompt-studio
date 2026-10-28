import { CloseButton, Dialog, Spinner } from "@chakra-ui/react";
import { KanbanRendererCreateDialog } from "@pstdio/ui/kanban-renderer";
import { useEffect, useState } from "react";
import type { RegisteredKanbanRendererContribution } from "../../core";
import { bindReactKanbanPresentation } from "../renderers/kanban/kanban-presentation";
import { useKanbanAttributes } from "../renderers/kanban/use-kanban-attributes";
import { RendererReadNotice } from "../renderers/renderer-read-notice";

interface RendererCreateDialogProps {
  contribution: RegisteredKanbanRendererContribution;
  onClose(): void;
}

export const RendererCreateDialog = (props: RendererCreateDialogProps) => {
  const { onClose } = props;
  const contribution = bindReactKanbanPresentation(props.contribution);
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
        draftKey={JSON.stringify([contribution.id, contribution.storageScope, "create"])}
        filter={contribution.defaultFilter}
        onClose={onClose}
        onSubmit={contribution.onCreateRow!}
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
                retry={() => {
                  setRead({ ready: false });
                  setRevision(revision + 1);
                }}
              />
            ) : (
              <Spinner />
            )}
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};
