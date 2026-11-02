import type { ComponentType, ReactNode } from "react";
import type {
  AttributeDescriptor,
  AttributesSource,
  BoardColumnConfig,
  KanbanRendererContribution,
  KanbanRendererRow,
  RegisteredKanbanRendererContribution,
  ResourceContextAction,
} from "../../../core";

type ReactColumnIcon = ComponentType<{ size?: number | string }>;
export type ReactAttributeDescriptor = AttributeDescriptor<ReactNode>;
export type ReactAttributesSource = AttributesSource<ReactNode>;
export type ReactBoardColumnConfig = BoardColumnConfig<ReactColumnIcon>;
export type ReactResourceContextAction = ResourceContextAction<ReactNode>;
export type ReactKanbanRendererContribution<TRow extends KanbanRendererRow = KanbanRendererRow> =
  KanbanRendererContribution<TRow, ReactNode, ReactColumnIcon>;

// The core stores presentation values without choosing a UI framework, as it
// does for view.render. Installing the React renderer binds that presentation.
// Components cast their prop to this type instead of calling a function: React Compiler treats a
// function's result as changeable and stops caching every callback that uses it.
export type ReactRegisteredKanbanRendererContribution = RegisteredKanbanRendererContribution<
  KanbanRendererRow,
  ReactNode,
  ReactColumnIcon
>;
