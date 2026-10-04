import type { DataTableRendererSettings, Localizable } from "@pstdio/sdk/extensions";
import type { CollectionViewsSource, KanbanRendererSettings } from "@pstdio/workbench";
import type {
  WorkbenchExtensionDataTableRendererAdapter,
  WorkbenchExtensionKanbanRendererAdapter,
} from "@pstdio/workbench/extensions";
import { dataTableBuiltInViews, kanbanBuiltInViews } from "pstdio-api-contracts";
import { createSharedCollectionViews } from "@/shared/collections/collection-views";
import {
  type ResolvedWorkbenchExtensionMetadata,
  resolveLocalizableString,
} from "@/shared/extensions/extension-localization";

type BoardRecord = Parameters<NonNullable<WorkbenchExtensionKanbanRendererAdapter["createViewsProvider"]>>[0];
type TableRecord = Parameters<NonNullable<WorkbenchExtensionDataTableRendererAdapter["createViewsProvider"]>>[0];

interface SharedViewsInput<TSettings> {
  projectId: string;
  record: {
    id: string;
    extensionId: string;
    defaultActiveViewId?: string;
    defaultViews?: { id: string; isDefault?: boolean }[];
    refreshEventIds?: string[];
  };
  metadata: ResolvedWorkbenchExtensionMetadata;
  builtIns: (Omit<CollectionViewsSource<TSettings>["views"][number], "title"> & { title: Localizable<string> })[];
}
const createSharedViews = <TSettings>(input: SharedViewsInput<TSettings>) => {
  const { projectId, record, metadata } = input;
  const extensionInstanceId = metadata.extensions.find(
    (extension) => extension.id === record.extensionId,
  )?.extensionInstanceId;
  const localId = metadata.views.find((view) => view.id === record.id)!.localId;
  return createSharedCollectionViews({
    projectId,
    extensionInstanceId,
    localId,
    record,
    builtIns: input.builtIns.map((view) => ({
      ...view,
      title: resolveLocalizableString(view.title, record.extensionId),
    })),
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
    builtIns: kanbanBuiltInViews(record).views,
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
    builtIns: dataTableBuiltInViews(record).views,
  });
