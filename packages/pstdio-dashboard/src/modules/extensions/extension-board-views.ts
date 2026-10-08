import type { DataTableRendererSettings } from "@pstdio/sdk/extensions";
import type { KanbanRendererSettings } from "@pstdio/workbench";
import type {
  WorkbenchExtensionDataTableRendererAdapter,
  WorkbenchExtensionKanbanRendererAdapter,
} from "@pstdio/workbench/extensions";
import { createSharedCollectionViews } from "@/shared/collections/collection-views";
import type { ResolvedWorkbenchExtensionMetadata } from "@/shared/extensions/extension-localization";

type BoardRecord = Parameters<NonNullable<WorkbenchExtensionKanbanRendererAdapter["createViewsProvider"]>>[0];
type TableRecord = Parameters<NonNullable<WorkbenchExtensionDataTableRendererAdapter["createViewsProvider"]>>[0];

interface SharedViewsInput {
  projectId: string;
  record: {
    id: string;
    extensionId: string;
    refreshEventIds?: string[];
  };
  metadata: ResolvedWorkbenchExtensionMetadata;
}
const createSharedViews = <TSettings>(input: SharedViewsInput) => {
  const { projectId, record, metadata } = input;
  const extensionInstanceId = metadata.extensions.find(
    (extension) => extension.id === record.extensionId,
  )?.extensionInstanceId;
  const localId = metadata.views.find((view) => view.id === record.id)!.localId;
  return createSharedCollectionViews<TSettings>({
    projectId,
    extensionInstanceId,
    localId,
    record,
  });
};

export const createSharedBoardViews = (
  projectId: string,
  record: BoardRecord,
  metadata: ResolvedWorkbenchExtensionMetadata,
) =>
  createSharedViews<KanbanRendererSettings>({
    projectId,
    record,
    metadata,
  });

export const createSharedTableViews = (
  projectId: string,
  record: TableRecord,
  metadata: ResolvedWorkbenchExtensionMetadata,
) =>
  createSharedViews<DataTableRendererSettings>({
    projectId,
    record,
    metadata,
  });
