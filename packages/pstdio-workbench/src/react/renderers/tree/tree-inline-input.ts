import type { TreeListNode, TreeListSection } from "@pstdio/ui";
import { useState } from "react";
import type { TreeActionParamsRequest } from "./tree-actions";

const actionInputOwner = Symbol("tree action input owner");

/** The native tree owns pending edits; extensions receive only the completed command. */
export const withTreeInlineInput = (
  sections: TreeListSection[],
  request: TreeActionParamsRequest | null,
  close: () => void,
) => {
  const presentation = request?.inlineInput;
  if (!presentation || !request) return sections;
  const descriptor = request.request.record.command.params?.[presentation.field];
  if (!descriptor || descriptor.type !== "text") return sections;
  const args = request.request.args && typeof request.request.args === "object" ? request.request.args : {};
  const initial = (args as Record<string, unknown>)[presentation.field] ?? descriptor.defaultValue;
  const input = {
    [actionInputOwner]: request,
    ariaLabel: descriptor.label ?? request.request.label,
    defaultValue: typeof initial === "string" ? initial : undefined,
    onCommit: async (value: string) => {
      if (descriptor.required && !value.trim())
        throw new Error(`${descriptor.label ?? presentation.field} is required`);
      await request.run({ ...args, [presentation.field]: value });
      close();
    },
    onCancel: close,
  };
  const existingIds = new Set<string>();
  const collectIds = (nodes: TreeListNode[]) => {
    for (const node of nodes) {
      existingIds.add(node.id);
      collectIds(node.children ?? []);
    }
  };
  for (const section of sections) collectIds(section.nodes);
  let pendingId = "workbench:inline-input";
  for (let suffix = 1; existingIds.has(pendingId); suffix++) pendingId = `workbench:inline-input:${suffix}`;
  const pending: TreeListNode = {
    id: pendingId,
    label: "",
    rowVariant: "file",
    canReorder: false,
    inlineInput: input,
  };
  const nodes = (values: TreeListNode[]): TreeListNode[] =>
    values.map((node) => {
      if (node.id === presentation.nodeId) {
        if (presentation.placement === "replace") return { ...node, inlineInput: input };
        return { ...node, isContainer: true, children: [pending, ...(node.children ?? [])] };
      }
      return node.children ? { ...node, children: nodes(node.children) } : node;
    });
  return sections.map((section, index) => {
    if (request.sectionId && request.sectionId !== section.id) return section;
    return {
      ...section,
      nodes:
        !presentation.nodeId && (request.sectionId || index === 0) ? [pending, ...section.nodes] : nodes(section.nodes),
    };
  });
};

interface TreeInputExpansion {
  expandedNodeIds: string[];
  expandedSectionIds: string[];
}

export const treeActionParamsFallback = (
  sections: TreeListSection[],
  request: TreeActionParamsRequest | null,
  expansion: TreeInputExpansion = { expandedNodeIds: [], expandedSectionIds: [] },
) => {
  if (!request?.inlineInput) return request;
  const hasInput = (nodes: TreeListNode[]): boolean =>
    nodes.some(
      (node) =>
        (node.inlineInput && actionInputOwner in node.inlineInput && node.inlineInput[actionInputOwner] === request) ||
        (expansion.expandedNodeIds.includes(node.id) && hasInput(node.children ?? [])),
    );
  const inlineVisible = sections.some(
    (section) =>
      (section.collapsible === false ||
        section.label === undefined ||
        expansion.expandedSectionIds.includes(section.id)) &&
      hasInput(section.nodes),
  );
  return inlineVisible ? null : request;
};

export const useTreeActionInput = (scope: string, expandedNodeIds: string[]) => {
  const [current, setCurrent] = useState<{ scope: string; request: TreeActionParamsRequest | null }>({
    scope,
    request: null,
  });
  if (current.scope !== scope) setCurrent({ scope, request: null });
  const request = current.scope === scope ? current.request : null;
  const close = () => setCurrent((value) => (value.request === request ? { scope, request: null } : value));
  const parent = request?.inlineInput?.placement === "child" ? request.inlineInput.nodeId : undefined;
  return {
    request,
    setRequest: (request: TreeActionParamsRequest | null) => setCurrent({ scope, request }),
    close,
    expandedNodeIds: parent ? [...expandedNodeIds, parent] : expandedNodeIds,
    sections: (sections: TreeListSection[]) => withTreeInlineInput(sections, request, close),
  };
};
