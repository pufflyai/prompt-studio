import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore } from "../../shared/store/workbench-store";
import { runWorkbenchEffect } from "../../shared/workbench-effect";
import type { TreeViewSection } from "../renderers/tree-renderer-registry";
import { settleReadBatch } from "../views/settle-read-batch";
import { stableNavigationValue } from "./navigation-target-key";
import { getNavigationTreeNodeSource } from "./navigation-tree-node-source";
import { mergeNavigationTreeSection } from "./navigation-tree-pages";
import { createNavigationTreeProjection, ownerId, scopedId } from "./navigation-tree-projection";
import { createNavigationTreeSnapshots } from "./navigation-tree-snapshots";

export type * from "./navigation-tree-types";

import type {
  CreateNavigationTreeRegistryInput,
  NavigationTreeContext,
  NavigationTreeContribution,
  NavigationTreeOwner,
  NavigationTreeRegistry,
  NavigationTreeSlot,
} from "./navigation-tree-types";

export { navigationRootSectionId, navigationSlotRootSectionId } from "./navigation-tree-projection";

const ownersEqual = (left: NavigationTreeOwner, right: NavigationTreeOwner) => ownerId(left) === ownerId(right);

const contributionOrder =
  (owner: NavigationTreeOwner) => (left: NavigationTreeContribution, right: NavigationTreeContribution) => {
    const leftOwn = left.sourceExtensionId === owner.extensionId;
    const rightOwn = right.sourceExtensionId === owner.extensionId;
    if (leftOwn !== rightOwn) return leftOwn ? -1 : 1;
    if (!leftOwn) {
      const extensionOrder = left.sourceExtensionId.localeCompare(right.sourceExtensionId);
      if (extensionOrder !== 0) return extensionOrder;
    }
    return left.declarationIndex - right.declarationIndex || left.id.localeCompare(right.id);
  };

const readContext = (contribution: NavigationTreeContribution, context: NavigationTreeContext) => ({
  ...context,
  projectId: context.projectId ?? context.resource?.projectId,
  resource: contribution.resolveResource ? contribution.resolveResource(context.resource) : context.resource,
});

export const createNavigationTreeRegistry = (input: CreateNavigationTreeRegistryInput = {}): NavigationTreeRegistry => {
  const contributions = new Map<string, NavigationTreeContribution>();
  const registryToken = {};
  const snapshots = createNavigationTreeSnapshots(input.queries, Boolean(input.subscribeViewRefresh));
  const observation = createWorkbenchStore({ name: "workbench.navigationTrees", initialState: { revision: 0 } });
  const registrations = new Map<string, Disposable>();
  let disposed = false;
  let registrationRevision = 0;
  const emit = () => {
    if (!disposed) observation.setState({ revision: observation.getState().revision + 1 });
  };
  const assertCurrent = (contribution: NavigationTreeContribution) => {
    if (disposed || contributions.get(contribution.id) !== contribution)
      throw new DOMException("Navigation provider is retired", "AbortError");
  };

  const matching = (owner: NavigationTreeOwner, slot: NavigationTreeSlot) =>
    [...contributions.values()]
      .filter((contribution) => ownersEqual(contribution.owner, owner) && (contribution.slot ?? "content") === slot)
      .sort(contributionOrder(owner));

  const { projectNode, projectSection } = createNavigationTreeProjection(registryToken, assertCurrent);

  const structureOf = (
    contribution: NavigationTreeContribution,
    owner: NavigationTreeOwner,
    context: NavigationTreeContext,
  ) => {
    const query = readContext(contribution, context);
    const structure =
      snapshots.get(contribution, query) ??
      (contribution.viewId ? input.getViewStructure?.(contribution.viewId, query) : contribution.getStructure?.(query));
    return (structure ?? []).map((section) => projectSection(section, contribution, owner, query));
  };

  const mergeSections = (groups: TreeViewSection[][]) => {
    const sections: TreeViewSection[] = [];
    for (const section of groups.flat()) mergeNavigationTreeSection(sections, section);
    return sections;
  };

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      observation.dispose();
      for (const registration of [...registrations.values()].reverse())
        runWorkbenchEffect("navigation contribution disposal", () => registration.dispose());
      registrations.clear();
      snapshots.dispose();
    },
    registerContribution(contribution) {
      if (disposed) throw new Error("Navigation registry is disposed");
      if (contributions.has(contribution.id)) {
        throw new Error(`Navigation tree contribution already registered: ${contribution.id}`);
      }
      if (!contribution.viewId && !contribution.getSections) {
        throw new Error(`Navigation tree contribution must declare a viewId or getSections: ${contribution.id}`);
      }
      contribution = { ...contribution };
      contributions.set(contribution.id, contribution);
      registrationRevision += 1;
      let refreshSubscription: Disposable | undefined;
      const registration = createDisposable(() => {
        if (contributions.get(contribution.id) !== contribution) return;
        contributions.delete(contribution.id);
        registrations.delete(contribution.id);
        snapshots.delete(contribution);
        runWorkbenchEffect("navigation refresh subscription disposal", () => refreshSubscription?.dispose());
        registrationRevision += 1;
        emit();
      });
      registrations.set(contribution.id, registration);
      try {
        if (contribution.viewId)
          refreshSubscription = input.subscribeViewRefresh?.(contribution.viewId, (event) => {
            if (disposed || contributions.get(contribution.id) !== contribution) return;
            snapshots.invalidate(contribution, event);
            emit();
          });
      } catch (error) {
        registration.dispose();
        throw error;
      }
      if (contributions.get(contribution.id) !== contribution) refreshSubscription?.dispose();
      emit();
      return registration;
    },

    resolveOwner(kind, id, slot) {
      return [...contributions.values()].find(
        (contribution) =>
          contribution.owner.kind === kind &&
          contribution.owner.id === id &&
          (!slot || (contribution.slot ?? "content") === slot),
      )?.owner;
    },

    getReadKey(owner, context = {}) {
      return JSON.stringify(
        stableNavigationValue(
          (["header", "content", "footer"] as const).flatMap((slot) =>
            matching(owner, slot).map((contribution) => [contribution.id, readContext(contribution, context).resource]),
          ),
        ),
      );
    },

    getStructure(owner, slot = "content", context = {}) {
      return mergeSections(matching(owner, slot).map((contribution) => structureOf(contribution, owner, context)));
    },

    async getSections(owner, slot = "content", context = {}) {
      const selected = matching(owner, slot);
      // Each contribution shows its declared structure until its own read replaces it.
      const available = selected.map((contribution) => structureOf(contribution, owner, context));
      const snapshot = () => mergeSections(available);
      await settleReadBatch(
        selected.map((contribution, index) => async (signal) => {
          const query = readContext(contribution, { ...context, signal });
          assertCurrent(contribution);
          const publish = (sections: TreeViewSection[]) => {
            signal.throwIfAborted();
            assertCurrent(contribution);
            available[index] = sections.map((section) => projectSection(section, contribution, owner, query));
            context.onProgress?.(snapshot());
          };
          const sections = await snapshots.readSections(
            contribution,
            query,
            async (signal, progress) => {
              assertCurrent(contribution);
              const source = { ...query, signal, onProgress: progress };
              return (
                (contribution.viewId
                  ? await input.getViewSections?.(contribution.viewId, source)
                  : await contribution.getSections?.(source)) ?? []
              );
            },
            publish,
          );
          publish(sections);
        }),
        context.signal,
      );
      return snapshot();
    },

    async getChildren(node, context = {}) {
      context.signal?.throwIfAborted();
      const source = getNavigationTreeNodeSource(node, registryToken);
      if (!source) return node.children ?? [];
      assertCurrent(source.contribution);
      const projectId = source.projectId ?? source.resource?.projectId ?? context.projectId;
      if (context.projectId && projectId && context.projectId !== projectId)
        throw new DOMException("Navigation node belongs to another project", "AbortError");
      const moveScope = node.moveScope ?? ownerId(source.contribution.owner);
      const query = { ...context, resource: source.resource, projectId };
      const children = await snapshots.readChildren(source.contribution, source.node, query, async (signal) => {
        assertCurrent(source.contribution);
        const context = { ...query, signal };
        const children = source.contribution.viewId
          ? await input.getViewChildren?.(source.contribution.viewId, source.node, context)
          : await source.contribution.getChildren?.(source.node, context);
        signal.throwIfAborted();
        assertCurrent(source.contribution);
        return children ?? source.node.children ?? [];
      });
      return children.map((child) => projectNode(child, source.contribution, moveScope, query));
    },

    async moveNode(sourceNode, targetNode, context = {}) {
      const source = getNavigationTreeNodeSource(sourceNode, registryToken);
      const target = targetNode ? getNavigationTreeNodeSource(targetNode, registryToken) : undefined;
      if (!source?.contribution.viewId || !source.node.canDrag) return;
      assertCurrent(source.contribution);
      if (context.projectId && source.projectId && context.projectId !== source.projectId)
        throw new DOMException("Navigation node belongs to another project", "AbortError");
      if (targetNode && (!target || source.contribution !== target.contribution || !target.node.canDrop)) return;
      if (target && source.projectId !== target.projectId)
        throw new DOMException("Navigation target belongs to another project", "AbortError");
      await input.moveViewNode?.(source.contribution.viewId, source.node, target?.node, {
        ...context,
        resource: source.resource,
        projectId: source.projectId ?? context.projectId,
      });
    },

    getDefaultExpandedSectionIds(owner, selectedSlot) {
      const slots: readonly NavigationTreeSlot[] = selectedSlot ? [selectedSlot] : ["header", "content", "footer"];
      return slots.flatMap((slot) =>
        matching(owner, slot).flatMap((contribution) =>
          (
            contribution.defaultExpandedSectionIds ??
            (contribution.viewId ? input.getViewDefaultExpandedSectionIds?.(contribution.viewId) : undefined) ??
            []
          ).map((id) => scopedId(contribution.idScope, id)),
        ),
      );
    },

    getDefaultExpandedNodeIds(owner, selectedSlot) {
      const slots: readonly NavigationTreeSlot[] = selectedSlot ? [selectedSlot] : ["header", "content", "footer"];
      return slots.flatMap((slot) =>
        matching(owner, slot).flatMap((contribution) =>
          (contribution.viewId ? (input.getViewDefaultExpandedNodeIds?.(contribution.viewId) ?? []) : []).map((id) =>
            scopedId(contribution.idScope, id),
          ),
        ),
      );
    },

    getRegistrationRevision: () => registrationRevision,
    onDidChange(listener) {
      return createDisposable(observation.subscribeSelector((state) => state.revision, listener));
    },
    listActions() {
      return [...contributions.values()].flatMap((contribution) =>
        (contribution.listActions?.() ?? []).map((action) => ({
          ...action,
          ownerId: contribution.sourceExtensionId,
        })),
      );
    },
  };
};
