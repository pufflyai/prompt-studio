import { Box, Button, Center, Flex, Text } from "@chakra-ui/react";
import { type PageParams, type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type {
  RegisteredFileRendererContribution,
  WorkbenchCore,
  WorkbenchPanelInstance,
  WorkbenchPanelRenderInput,
} from "../../../core";
import { getWorkbenchRenderers, rendererReadKey } from "../../../core";
import {
  getFileSectionNavigation,
  resolveFileSectionTargetId,
} from "../../../core/registries/renderers/file-section-navigation";
import { useOpenPlacementIds } from "../../shared/use-open-placement-ids";
import { usePageParams } from "../use-page-params";
import { getNativeMarkdownConnection, getPublicMarkdownConnection } from "./file-renderer-connections";
import { FileRendererContentView } from "./file-renderer-content";
import {
  createFileEditController,
  type FileEditController,
  type FileEditControllerState,
} from "./file-renderer-edit-state";
import { createFileRendererLoadKey, isCurrentLoadedFile } from "./file-renderer-load-key";
import { acceptFileRendererLoad, type LoadedFile, matchesFileScope } from "./file-renderer-load-state";
import { FileRendererPathHeader } from "./file-renderer-path-header";
import { prepareFileRendererSave } from "./file-renderer-save-operation";
import { useFileSectionSelection } from "./file-renderer-sections";
import { FileRendererStatusNotice } from "./file-renderer-status-notice";
import { SelectedTextEditor } from "./selected-text-editor";
import { useFileRendererAuthority } from "./use-file-renderer-authority";

interface WorkbenchFileRendererViewProps {
  workbench: WorkbenchCore;
  contribution: RegisteredFileRendererContribution;
  // The bound resource (e.g. the open ticket / ticket-file) the load/save
  // commands operate on.
  placement?: WorkbenchPanelInstance;
  presentationInput?: WorkbenchPanelRenderInput;
}
const SAVE_DEBOUNCE_MS = 600;
const describeError = (error: unknown) => (error instanceof Error ? error.message : "Failed to load file.");
const syncActiveFileSection = (input: {
  workbench: WorkbenchCore;
  navigation: ReturnType<typeof getFileSectionNavigation>;
  sectionId: string | null;
}) => {
  const { workbench, navigation, sectionId } = input;
  if (!navigation || !getWorkbenchRenderers(workbench).getTreeRenderer(navigation.treeId)) return;
  if (sectionId && navigation.anchors.some((anchor) => anchor.id === sectionId)) {
    getWorkbenchRenderers(workbench).setSelectedNode(navigation.treeId, sectionId);
    return;
  }
  const selectedNodeId = getWorkbenchRenderers(workbench).getTreeState(navigation.treeId).selectedNodeId;
  if (selectedNodeId && navigation.anchors.some((anchor) => anchor.id === selectedNodeId)) {
    getWorkbenchRenderers(workbench).setSelectedNode(navigation.treeId, undefined);
  }
};
const getEditorSectionNavigation = (
  workbench: WorkbenchCore,
  navigation: ReturnType<typeof getFileSectionNavigation>,
) => {
  if (!navigation) return undefined;
  const selectedNodeId = getWorkbenchRenderers(workbench).getTreeRenderer(navigation.treeId)
    ? getWorkbenchRenderers(workbench).getTreeState(navigation.treeId).selectedNodeId
    : undefined;
  return {
    anchors: navigation.anchors,
    targetId: resolveFileSectionTargetId(navigation, selectedNodeId),
  };
};
const FileRendererHeader = (props: { file: LoadedFile; dirty: boolean }) => {
  const { file, dirty } = props;
  return file.filePath ? (
    <FileRendererPathHeader fileName={file.fileName ?? file.filePath} filePath={file.filePath} dirty={dirty} />
  ) : null;
};

const fileRendererOwnerKey = (
  placement: WorkbenchPanelInstance | undefined,
  contributionId: string,
  loadKey: string,
  queryScope: RegisteredFileRendererContribution["queryScope"],
) => JSON.stringify([placement ? rendererReadKey(placement) : ["file", contributionId, loadKey], queryScope]);

const useFileRendererBinding = (input: {
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
            if (!cancelled) setEditState(state);
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
            accept(receipt, value) {
              baseline = receipt.content;
              if (baseline) cache.store(cacheKey, baseline, scope);
              controller?.confirmSave(value, receipt.result?.revision);
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
      read.dispose();
      stopRetirement();
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

export const WorkbenchFileRendererView = (props: WorkbenchFileRendererViewProps) => {
  const { workbench, contribution } = props;
  const resource = props.placement?.resource;
  const openPlacements = useOpenPlacementIds(workbench);
  const open = !props.placement?.placementIdentity || openPlacements.has(props.placement.instanceId);
  const position = props.placement?.position;
  const sectionNavigation = getFileSectionNavigation(resource);
  const requestedSection = props.placement?.section;
  const targetAnchor = requestedSection?.anchors.at(-1);
  const editorSectionNavigation =
    requestedSection && targetAnchor
      ? { anchors: [...requestedSection.anchors], targetId: targetAnchor.id }
      : getEditorSectionNavigation(workbench, sectionNavigation);
  const pageParams = usePageParams(workbench, props.placement);
  const queryScope = contribution.queryScope ?? { projectId: resource?.projectId };
  const authority = useFileRendererAuthority(workbench, queryScope);
  const documentKey = createFileRendererLoadKey({
    fileRendererId: contribution.id,
    resource,
    pageParams,
    documentKey: contribution.documentKey?.(resource),
  });
  const cacheKey = `${documentKey}:${JSON.stringify([queryScope.projectId, queryScope.extensionId])}`;
  const loadKey = `${cacheKey}:${authority.generation}`;
  const manualSave = contribution.saveMode === "manual";
  const { loaded, error, editState, controllerRef, retryReadRef } = useFileRendererBinding({
    workbench,
    contribution,
    resource,
    pageParams,
    placement: props.placement,
    loadKey,
    cacheKey,
    manualSave,
    authority,
  });
  const rendererRef = useRef<HTMLDivElement>(null);
  useFileSectionSelection(workbench, resource, sectionNavigation);
  const currentLoaded = isCurrentLoadedFile(loaded, loadKey) ? loaded : null;
  const loadError = error?.loadKey === loadKey ? error.message : undefined;
  if (currentLoaded?.textEditor)
    return <SelectedTextEditor {...props} open={open} content={currentLoaded} pageParams={pageParams} />;
  if (loadError && !currentLoaded) {
    return (
      <Center h="full" minH="0" bg="bg" p="md" flexDirection="column" gap="sm">
        <Text color="fg.muted">{loadError}</Text>
        <Button size="xs" variant="subtle" onClick={() => retryReadRef.current?.()}>
          Retry
        </Button>
      </Center>
    );
  }
  // The key must carry the document identity, not just the contribution: two
  // documents from the same renderer both start at revision 1, so keying on the
  // contribution alone reuses the editor and keeps showing the previous file.
  let editorKey = currentLoaded ? `${currentLoaded.loadKey}:${currentLoaded.editorRevision}` : "";
  const connectDocument = getNativeMarkdownConnection(contribution, currentLoaded, resource, pageParams);
  const connectText = getPublicMarkdownConnection(contribution, currentLoaded, props.presentationInput, pageParams);
  const sharedEditor = connectText ?? connectDocument;
  if (sharedEditor && currentLoaded) editorKey = currentLoaded.loadKey;
  const errorNotice = (
    <FileRendererStatusNotice
      state={editState}
      loadError={loadError}
      retryRead={() => retryReadRef.current?.()}
      retrySave={() => controllerRef.current?.retry()}
    />
  );
  if (!open && editState.removed) return errorNotice;
  return (
    <Flex
      direction="column"
      h="full"
      minH="0"
      bg="bg"
      onKeyDownCapture={(event) => {
        if (manualSave && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
          event.preventDefault();
          event.stopPropagation();
          controllerRef.current?.flush();
        }
      }}
    >
      {currentLoaded && !sharedEditor && (
        <FileRendererHeader file={currentLoaded} dirty={manualSave && editState.dirty} />
      )}
      <Box flex="1" minH="0">
        <FileRendererContentView
          presence={workbench.presence}
          open={open}
          content={currentLoaded}
          position={position}
          editorKey={editorKey}
          errorNotice={errorNotice}
          contributionCanSave={Boolean(contribution.save)}
          onActiveSectionChange={
            sectionNavigation
              ? (sectionId) => syncActiveFileSection({ workbench, navigation: sectionNavigation, sectionId })
              : undefined
          }
          onChange={(value) => controllerRef.current?.handleChange(value)}
          rendererRef={rendererRef}
          sectionNavigation={editorSectionNavigation}
          title={resource?.label ?? contribution.title}
          connectDocument={connectDocument}
          connectText={connectText}
        />
      </Box>
    </Flex>
  );
};
