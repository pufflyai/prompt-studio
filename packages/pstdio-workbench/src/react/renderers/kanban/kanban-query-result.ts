import type { KanbanRendererRow, RegisteredKanbanRendererContribution } from "../../../core";
import type { useRendererPages } from "../use-renderer-pages";
import type { ReactAttributeDescriptor, ReactRegisteredKanbanRendererContribution } from "./kanban-presentation";

type QueryResult = Awaited<ReturnType<NonNullable<ReactRegisteredKanbanRendererContribution["executeQueryResult"]>>>;

export const loadKanbanRows = async (
  contribution: ReactRegisteredKanbanRendererContribution,
  state: Parameters<RegisteredKanbanRendererContribution["executeQuery"]>[0],
  pages: ReturnType<typeof useRendererPages<KanbanRendererRow>>,
  signal: AbortSignal,
  accepted?: QueryResult,
) => {
  const executePage = contribution.executePage;
  const read = async () => {
    const result: QueryResult = contribution.executeQueryResult
      ? await contribution.executeQueryResult(state, signal)
      : { rows: await contribution.executeQuery(state, signal) };
    return { ...result, page: undefined, position: undefined };
  };
  const result = executePage
    ? await pages.load((page) => executePage({ ...state, page }, signal), signal)
    : await read();
  // Missing presentation retains the accepted value; explicit empty containers remove it.
  return {
    ...result,
    attributes: result.attributes ?? accepted?.attributes,
    boardColumnConfigs: result.boardColumnConfigs ?? accepted?.boardColumnConfigs,
  };
};

export const resolveKanbanQueryPresentation = (
  contribution: ReactRegisteredKanbanRendererContribution,
  result: QueryResult | undefined,
  declared: ReactAttributeDescriptor[],
) => {
  const configs = result?.boardColumnConfigs;
  return {
    attributes: result?.attributes ?? declared,
    getBoardColumnConfig: configs ? (key: string) => configs[key] ?? {} : contribution.getBoardColumnConfig,
  };
};
