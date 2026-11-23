import { type PageParams, type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  getWorkbenchRenderers,
  type RegisteredFileRendererContribution,
  rendererReadKey,
  type WorkbenchCore,
  type WorkbenchPanelInstance,
} from "../../../core";
import {
  createFileEditController,
  type FileEditController,
  type FileEditControllerState,
} from "./file-renderer-edit-state";
import { acceptFileRendererLoad, type LoadedFile, matchesFileScope } from "./file-renderer-load-state";
import { afterFileSaveSettles, prepareFileRendererSave } from "./file-renderer-save-operation";
import type { useFileRendererAuthority } from "./use-file-renderer-authority";

const SAVE_DEBOUNCE_MS = 600;
const describeError = (error: unknown) => (error instanceof Error ? error.message : "Failed to load file.");

const fileRendererOwnerKey = (
  placement: WorkbenchPanelInstance | undefined,
  contributionId: string,
  loadKey: string,
  queryScope: RegisteredFileRendererContribution["queryScope"],
) => JSON.stringify([placement ? rendererReadKey(placement) : ["file", contributionId, loadKey], queryScope]);

export const useFileRendererBinding = (input: {
  workbench: WorkbenchCore;
  contribution: RegisteredFileRendererContribution;
  resource?: ResourceRef;
  pageParams?: PageParams;
  placement?: WorkbenchPanelInstance;
  loadKey: string;
  cacheKey: string;
  manualSave: boolean;
  authority: ReturnType<typeof useFileRendererAuthority>;
}) => {
  const { workbench, contribution, resource, pageParams, placement, loadKey, cacheKey, manualSave } = input;
  const { queries, cache } = input.authority;
  const [loaded, setLoaded] = useState<LoadedFile | null>(null);
  const [error, setError] = useState<{
    loadKey: string;
    message: string;
  } | null>(null);
  const [editState, setEditState] = useState<FileEditControllerState>({ dirty: false, saving: false });
  const controllerRef = useRef<FileEditController | null>(null);
  const retryReadRef = useRef<(() => void) | undefined>(undefined);
  // Contribution refresh re-registers an identical contribution as a new
  // object, and a save that changes the document title produces a new resource
  // object with a fresh label. The load key uses resource values instead of
  // object identity, while callbacks read the latest objects through refs.
  const contributionRef = useRef(contribution);
  const resourceRef = useRef(resource);
  const pageParamsRef = useRef(pageParams);
  const placementRef = useRef(placement);
  useLayoutEffect(() => {
    contributionRef.current = contribution;
    resourceRef.current = resource;
    pageParamsRef.current = pageParams;
    placementRef.current = placement;
  });
  const contributionId = contribution.id;
  const hasSave = Boolean(contribution.save);
  const ownerKey = fileRendererOwnerKey(placement, contributionId, loadKey, contribution.queryScope);
  const instanceId = placement?.instanceId ?? contributionId;
  // Re-binding a singleton widget to another resource changes `resource` and reloads.
  useLayoutEffect(() => {
    let cancelled = false;
    let removed = false;
    let retired = false;
    const boundResource = resourceRef.current;
    const boundContribution = contributionRef.current;
    const boundPageParams = pageParamsRef.current;
    const scope = {
      ...queries.getScope(),
      ...boundContribution.queryScope,
      projectId: boundContribution.queryScope?.projectId ?? boundResource?.projectId,
    };
    const stopRetirement = queries.subscribeScopeRetirement((scopeFilter) => {
      if (matchesFileScope(scope, scopeFilter)) retired = true;
    });
    const read = workbench.views.reads.bind(ownerKey);
    let controller: FileEditController | null = null;
    let stopObservingSave: (() => void) | undefined;
    let retainDraftOnClose: (() => void) | undefined;
    setError(null);
    // A recently viewed document mounts immediately from the cache; the load
    // below reconciles it (unchanged content keeps the editor mounted).
    const cached = cache.read(cacheKey);
    let baseline = cached;
    setLoaded(cached ? { ...cached, editorRevision: 1, loadKey } : null);
    const load = (reason: "refresh" | "retry" = "refresh") => {
      read.request(
        {
          queryKey: loadKey,
          queryScope: contributionRef.current.queryScope,
          sourceId: contributionId,
          load: (signal) => contributionRef.current.load(resourceRef.current, signal, pageParamsRef.current),
          onValue: (next) => {
            if (cancelled || removed || retired) return;
            const updateLoaded = acceptFileRendererLoad(next, loadKey, controller);
            if (!updateLoaded) return;
            baseline = next;
            cache.store(cacheKey, next, scope);
            setError(null);
            setLoaded(updateLoaded);
          },
          onError: (loadError) => {
            if (cancelled || removed || retired) return;
            setError({ loadKey, message: describeError(loadError) });
          },
        },
        reason,
      );
    };
    retryReadRef.current = () => load("retry");
    controller = hasSave
      ? createFileEditController({
          binding: {
            rendererId: contributionId,
            instanceId,
            resourceKey: resourceKey(resourceRef.current),
          },
          debounceMs: SAVE_DEBOUNCE_MS,
          saveMode: manualSave ? "manual" : "auto",
          saveKey: cacheKey,
          saveOwner: queries,
          load: () => load(),
          onStateChange: (state) => {
            if (cancelled) return;
            setEditState(state);
            if (state.saveUnconfirmed && !stopObservingSave) {
              stopObservingSave = afterFileSaveSettles(queries, cacheKey, () => {
                stopObservingSave = undefined;
                if (
                  cancelled ||
                  retired ||
                  removed ||
                  !matchesFileScope(queries.getScope(), {
                    runtimeId: scope.runtimeId,
                    accountId: scope.accountId,
                    accountOrigin: scope.accountOrigin,
                  })
                )
                  return;
                const confirmed = cache.read(cacheKey);
                if (confirmed?.content === undefined) return;
                baseline = confirmed;
                controller?.confirmSave(confirmed.content, confirmed.revision);
              });
            }
          },
          prepareSave: prepareFileRendererSave({
            queries,
            scope,
            contribution: boundContribution,
            resource: boundResource,
            pageParams: boundPageParams,
            loadKey: cacheKey,
            readBaseline: () => baseline,
            available: () => !removed && !retired,
            retainDraft(submitted, updateDraft) {
              retainDraftOnClose = () => {
                const draft = controller?.getDraft();
                if (draft !== undefined && draft !== submitted) updateDraft({ submitted, draft });
              };
              if (cancelled) retainDraftOnClose();
            },
            accept(receipt) {
              baseline = receipt.content;
              if (baseline) cache.store(cacheKey, baseline, scope);
            },
          }),
        })
      : null;
    controllerRef.current = controller;
    if (cached) controllerRef.current?.setBaseline(cached.content, cached.revision);
    setEditState({ dirty: false, saving: false });
    load();
    const removalSubscription = workbench.resources.onWillRemove((resource) => {
      if (resourceKey(resource) !== resourceKey(resourceRef.current)) return [];
      removed = true;
      const retain = controllerRef.current?.markRemoved();
      setEditState((state) => ({ ...state, removed: true }));
      const identity = placementRef.current?.placementIdentity;
      return retain && identity ? [identity] : [];
    });
    const refreshSubscription = getWorkbenchRenderers(workbench).onDidRefreshFileRenderer((event) => {
      if (removed || retired || event.fileRendererId !== contributionId) return;
      const controller = controllerRef.current;
      if (controller) controller.handleRefreshEvent(event);
      else load();
    });
    return () => {
      cancelled = true;
      retainDraftOnClose?.();
      read.dispose();
      stopRetirement();
      stopObservingSave?.();
      retryReadRef.current = undefined;
      refreshSubscription.dispose();
      removalSubscription.dispose();
      // Only autosave files flush when their editor is unbound.
      if (!manualSave) controller?.flush();
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, [contributionId, hasSave, workbench, loadKey, ownerKey, instanceId, manualSave, queries, cache, cacheKey]);
  useEffect(() => {
    if (manualSave) return;
    const flush = () => controllerRef.current?.flush();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [manualSave]);
  return { loaded, error, editState, controllerRef, retryReadRef };
};
