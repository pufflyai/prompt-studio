import { Box, Button, Center, Flex, Text } from "@chakra-ui/react";
import { resourceKey } from "@pstdio/sdk/extensions";
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RegisteredFileRendererContribution, WorkbenchCore, WorkbenchPanelInstance } from "../../../core";
import { getWorkbenchRenderers, rendererReadKey } from "../../../core";
import {
  getFileSectionNavigation,
  resolveFileSectionTargetId,
  shouldClearFileSectionSelection,
} from "../../../core/registries/renderers/file-section-navigation";
import { usePageParams } from "../use-page-params";
import { FileRendererContentView } from "./file-renderer-content";
import {
  createFileEditController,
  type FileEditController,
  type FileEditControllerState,
} from "./file-renderer-edit-state";
import { FileRendererErrorNotice } from "./file-renderer-error-notice";
import { createFileRendererLoadKey, isCurrentLoadedFile } from "./file-renderer-load-key";
import {
  acceptFileRendererLoad,
  type LoadedFile,
  readCachedFileContent,
  saveLoadedFile,
  storeCachedFileContent,
} from "./file-renderer-load-state";
import { FileRendererPathHeader } from "./file-renderer-path-header";

interface WorkbenchFileRendererViewProps {
  workbench: WorkbenchCore;
  contribution: RegisteredFileRendererContribution;
  // The bound resource (e.g. the open ticket / ticket-file) the load/save
  // commands operate on.
  placement?: WorkbenchPanelInstance;
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
const FileRendererHeader = (props: { file: LoadedFile }) => {
  const { file } = props;
  return file.filePath ? (
    <FileRendererPathHeader fileName={file.fileName ?? file.filePath} filePath={file.filePath} />
  ) : null;
};

const fileRendererOwnerKey = (
  placement: WorkbenchPanelInstance | undefined,
  contributionId: string,
  loadKey: string,
) => (placement ? rendererReadKey(placement) : JSON.stringify(["file", contributionId, loadKey]));

export const WorkbenchFileRendererView = (props: WorkbenchFileRendererViewProps) => {
  const { workbench, contribution } = props;
  const resource = props.placement?.resource;
  const position = props.placement?.position;
  const sectionNavigation = getFileSectionNavigation(resource);
  const requestedSection = props.placement?.section;
  const targetAnchor = requestedSection?.anchors.at(-1);
  const editorSectionNavigation =
    requestedSection && targetAnchor
      ? { anchors: [...requestedSection.anchors], targetId: targetAnchor.id }
      : getEditorSectionNavigation(workbench, sectionNavigation);
  const pageParams = usePageParams(workbench, props.placement);
  const loadKey = createFileRendererLoadKey({ fileRendererId: contribution.id, resource, pageParams });
  const [loaded, setLoaded] = useState<LoadedFile | null>(null);
  const [error, setError] = useState<{
    loadKey: string;
    message: string;
  } | null>(null);
  const [editState, setEditState] = useState<FileEditControllerState>({ dirty: false, saving: false });
  const controllerRef = useRef<FileEditController | null>(null);
  const retryReadRef = useRef<(() => void) | undefined>(undefined);
  const rendererRef = useRef<HTMLDivElement>(null);
  const previousSectionNavigationRef = useRef<{
    resourceKey?: string;
    treeId: string;
    anchorIds: string[];
  } | null>(null);
  useEffect(() => {
    const previous = previousSectionNavigationRef.current;
    const selectedNodeId =
      previous && getWorkbenchRenderers(workbench).getTreeRenderer(previous.treeId)
        ? getWorkbenchRenderers(workbench).getTreeState(previous.treeId).selectedNodeId
        : undefined;
    if (
      shouldClearFileSectionSelection({
        previous,
        current: sectionNavigation,
        currentResourceKey: resourceKey(resource),
        selectedNodeId,
      }) &&
      previous
    ) {
      getWorkbenchRenderers(workbench).setSelectedNode(previous.treeId, undefined);
    }
    previousSectionNavigationRef.current = sectionNavigation
      ? {
          resourceKey: resourceKey(resource),
          treeId: sectionNavigation.treeId,
          anchorIds: sectionNavigation.anchors.map((anchor) => anchor.id),
        }
      : null;
  }, [resource, sectionNavigation, workbench]);
  // Contribution refresh re-registers an identical contribution as a new
  // object, and a save that changes the document title produces a new resource
  // object with a fresh label. The load key uses resource values instead of
  // object identity, while callbacks read the latest objects through refs.
  const contributionRef = useRef(contribution);
  const resourceRef = useRef(resource);
  const pageParamsRef = useRef(pageParams);
  const placementRef = useRef(props.placement);
  useLayoutEffect(() => {
    contributionRef.current = contribution;
    resourceRef.current = resource;
    pageParamsRef.current = pageParams;
    placementRef.current = props.placement;
  });
  const contributionId = contribution.id;
  const hasSave = Boolean(contribution.save);
  const ownerKey = fileRendererOwnerKey(props.placement, contributionId, loadKey);
  const instanceId = props.placement?.instanceId ?? contributionId;
  // Re-binding a singleton widget to another resource changes `resource` and reloads.
  useLayoutEffect(() => {
    let cancelled = false;
    let removed = false;
    const boundResource = resourceRef.current;
    const boundContribution = contributionRef.current;
    const read = workbench.views.reads.bind(ownerKey);
    let controller: FileEditController | null = null;
    setError(null);
    // A recently viewed document mounts immediately from the cache; the load
    // below reconciles it (unchanged content keeps the editor mounted).
    const cached = readCachedFileContent(loadKey);
    let baseline = cached;
    setLoaded(cached ? { ...cached, editorRevision: 1, loadKey } : null);
    const load = (reason: "refresh" | "retry" = "refresh") => {
      read.request(
        {
          queryKey: loadKey,
          load: (signal) => contributionRef.current.load(resourceRef.current, signal, pageParamsRef.current),
          onValue: (next) => {
            if (cancelled || removed) return;
            const updateLoaded = acceptFileRendererLoad(next, loadKey, controller);
            if (!updateLoaded) return;
            baseline = next;
            setError(null);
            setLoaded(updateLoaded);
          },
          onError: (loadError) => {
            if (cancelled || removed) return;
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
          load: () => load(),
          onStateChange: (state) => {
            if (!cancelled) setEditState(state);
          },
          save: async (value, origin) => {
            const saved = await saveLoadedFile(boundContribution, boundResource, value, origin, baseline);
            baseline = saved.content;
            if (baseline && !removed) storeCachedFileContent(loadKey, baseline);
            return saved.result;
          },
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
      const identity = placementRef.current?.placementIdentity;
      return retain && identity ? [identity] : [];
    });
    const refreshSubscription = getWorkbenchRenderers(workbench).onDidRefreshFileRenderer((event) => {
      if (removed || event.fileRendererId !== contributionId) return;
      const controller = controllerRef.current;
      if (controller) controller.handleRefreshEvent(event);
      else load();
    });
    return () => {
      cancelled = true;
      read.dispose();
      retryReadRef.current = undefined;
      refreshSubscription.dispose();
      removalSubscription.dispose();
      // Flush the last keystrokes on unbind; the load callback above is
      // cancelled, so a deferred refresh cannot resurrect the old binding.
      controller?.flush();
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, [contributionId, hasSave, workbench, loadKey, ownerKey, instanceId]);
  // The last keystrokes are also flushed when the tab is hidden or closed.
  useEffect(() => {
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
  }, []);
  const handleChange = (value: string) => {
    controllerRef.current?.handleChange(value);
  };
  const currentLoaded = isCurrentLoadedFile(loaded, loadKey) ? loaded : null;
  const loadError = error?.loadKey === loadKey ? error.message : undefined;
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
  const editorKey = currentLoaded ? `${currentLoaded.loadKey}:${currentLoaded.editorRevision}` : "";
  let errorNotice: ReactNode = null;
  if (editState.removed) {
    errorNotice = (
      <FileRendererErrorNotice message="This resource was removed. Your draft is kept here. Copy it before closing this tab." />
    );
  } else if (loadError) {
    errorNotice = <FileRendererErrorNotice message={loadError} onRetry={() => retryReadRef.current?.()} />;
  } else if (editState.saveError) {
    errorNotice = (
      <FileRendererErrorNotice message={editState.saveError} onRetry={() => controllerRef.current?.retry()} />
    );
  }
  return (
    <Flex direction="column" h="full" minH="0" bg="bg">
      {currentLoaded && <FileRendererHeader file={currentLoaded} />}
      <Box flex="1" minH="0">
        <FileRendererContentView
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
          onChange={handleChange}
          rendererRef={rendererRef}
          sectionNavigation={editorSectionNavigation}
          title={contribution.title}
        />
      </Box>
    </Flex>
  );
};
