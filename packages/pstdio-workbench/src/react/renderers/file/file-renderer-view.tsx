import { Box, Button, Center, Flex, Spinner, Text } from "@chakra-ui/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type {
  FileRendererContent,
  RegisteredFileRendererContribution,
  WorkbenchCore,
  WorkbenchPanelInstance,
} from "../../../core";
import {
  getFileSectionNavigation,
  resolveFileSectionTargetId,
  shouldClearFileSectionSelection,
} from "../../../core/registries/renderers/file-section-navigation";
import { FileRendererContentView } from "./file-renderer-content";
import {
  createFileEditController,
  type FileEditController,
  type FileEditControllerState,
  nextLoadedRevision,
  readCachedFileContent,
  storeCachedFileContent,
} from "./file-renderer-edit-state";
import { FileRendererErrorNotice } from "./file-renderer-error-notice";
import { createFileRendererLoadKey, isCurrentLoadedFile } from "./file-renderer-load-key";
import { FileRendererPathHeader } from "./file-renderer-path-header";

interface WorkbenchFileRendererViewProps {
  workbench: WorkbenchCore;
  contribution: RegisteredFileRendererContribution;
  // The bound resource (e.g. the open ticket / ticket-file) the load/save
  // commands operate on.
  placement?: WorkbenchPanelInstance;
}

interface LoadedFile extends FileRendererContent {
  // Bumped on every (re)load so the uncontrolled editors remount with fresh
  // content on a refresh, but never mid-edit (load only runs on mount/refresh).
  editorRevision: number;
  loadKey: string;
}

const SAVE_DEBOUNCE_MS = 600;

const describeError = (error: unknown) => (error instanceof Error ? error.message : "Failed to load file.");

const syncActiveFileSection = (input: {
  workbench: WorkbenchCore;
  navigation: ReturnType<typeof getFileSectionNavigation>;
  sectionId: string | null;
}) => {
  const { workbench, navigation, sectionId } = input;
  if (!navigation || !workbench.renderers.getTreeRenderer(navigation.treeId)) return;

  if (sectionId && navigation.anchors.some((anchor) => anchor.id === sectionId)) {
    workbench.renderers.setSelectedNode(navigation.treeId, sectionId);
    return;
  }

  const selectedNodeId = workbench.renderers.getTreeState(navigation.treeId).selectedNodeId;
  if (selectedNodeId && navigation.anchors.some((anchor) => anchor.id === selectedNodeId)) {
    workbench.renderers.setSelectedNode(navigation.treeId, undefined);
  }
};

const getEditorSectionNavigation = (
  workbench: WorkbenchCore,
  navigation: ReturnType<typeof getFileSectionNavigation>,
) => {
  if (!navigation) return undefined;
  const selectedNodeId = workbench.renderers.getTreeRenderer(navigation.treeId)
    ? workbench.renderers.getTreeState(navigation.treeId).selectedNodeId
    : undefined;

  return {
    anchors: navigation.anchors,
    targetId: resolveFileSectionTargetId(navigation, selectedNodeId),
  };
};

export const WorkbenchFileRendererView = (props: WorkbenchFileRendererViewProps) => {
  const { workbench, contribution } = props;
  const resource = props.placement?.resource;
  const sectionNavigation = getFileSectionNavigation(resource);
  const editorSectionNavigation = getEditorSectionNavigation(workbench, sectionNavigation);
  const loadKey = createFileRendererLoadKey({ fileRendererId: contribution.id, resource });
  const [loaded, setLoaded] = useState<LoadedFile | null>(null);
  const [error, setError] = useState<{ loadKey: string; message: string } | null>(null);
  const [editState, setEditState] = useState<FileEditControllerState>({ dirty: false, saving: false });
  const controllerRef = useRef<FileEditController | null>(null);
  const rendererRef = useRef<HTMLDivElement>(null);
  const previousSectionNavigationRef = useRef<{
    resourceUri?: string;
    treeId: string;
    anchorIds: string[];
  } | null>(null);

  useEffect(() => {
    const previous = previousSectionNavigationRef.current;
    const selectedNodeId =
      previous && workbench.renderers.getTreeRenderer(previous.treeId)
        ? workbench.renderers.getTreeState(previous.treeId).selectedNodeId
        : undefined;

    if (
      shouldClearFileSectionSelection({
        previous,
        current: sectionNavigation,
        currentResourceUri: resource?.uri,
        selectedNodeId,
      }) &&
      previous
    ) {
      workbench.renderers.setSelectedNode(previous.treeId, undefined);
    }

    previousSectionNavigationRef.current = sectionNavigation
      ? {
          resourceUri: resource?.uri,
          treeId: sectionNavigation.treeId,
          anchorIds: sectionNavigation.anchors.map((anchor) => anchor.id),
        }
      : null;
  }, [resource?.uri, sectionNavigation, workbench]);

  // Contribution refresh re-registers an identical contribution as a new
  // object, and a save that changes the document title produces a new resource
  // object with a fresh label. The load key uses resource values instead of
  // object identity, while callbacks read the latest objects through refs.
  const contributionRef = useRef(contribution);
  const resourceRef = useRef(resource);
  useEffect(() => {
    contributionRef.current = contribution;
    resourceRef.current = resource;
  });

  const contributionId = contribution.id;
  const hasSave = Boolean(contribution.save);

  // Re-binding a singleton widget to another resource changes `resource` and reloads.
  useEffect(() => {
    let cancelled = false;
    setError(null);
    // A recently viewed document mounts immediately from the cache; the load
    // below reconciles it (unchanged content keeps the editor mounted).
    const cached = readCachedFileContent(loadKey);
    setLoaded(cached ? { ...cached, editorRevision: 1, loadKey } : null);
    const load = () => {
      Promise.resolve(contributionRef.current.load(resourceRef.current))
        .then((next) => {
          if (cancelled) return;
          if (controllerRef.current && !controllerRef.current.acceptLoaded(next.content, next.revision)) return;
          setError(null);
          storeCachedFileContent(loadKey, next);
          // Compare against the editor's current value so a reload that returns
          // what is already shown (e.g. after a save) keeps the editor mounted.
          const editorValue = controllerRef.current?.getBaseline();
          setLoaded((previous) => ({
            ...next,
            editorRevision: nextLoadedRevision(previous, next, loadKey, editorValue),
            loadKey,
          }));
        })
        .catch((loadError) => {
          if (cancelled) return;
          setError({ loadKey, message: describeError(loadError) });
        });
    };
    controllerRef.current = hasSave
      ? createFileEditController({
          binding: {
            rendererId: contributionId,
            instanceId: props.placement?.instanceId ?? contributionId,
            resourceUri: resourceRef.current?.uri,
          },
          debounceMs: SAVE_DEBOUNCE_MS,
          load,
          onStateChange: (state) => {
            if (!cancelled) setEditState(state);
          },
          save: (value, origin) =>
            Promise.resolve(contributionRef.current.save?.(resourceRef.current, value, origin)).then((result) => {
              const current = readCachedFileContent(loadKey);
              if (current) storeCachedFileContent(loadKey, { ...current, content: value });
              return result ?? undefined;
            }),
        })
      : null;
    if (cached) controllerRef.current?.setBaseline(cached.content, cached.revision);
    setEditState({ dirty: false, saving: false });
    load();
    const refreshSubscription = workbench.renderers.onDidRefreshFileRenderer((event) => {
      if (event.fileRendererId !== contributionId) return;
      const controller = controllerRef.current;
      if (controller) controller.handleRefreshEvent(event);
      else load();
    });
    return () => {
      cancelled = true;
      refreshSubscription.dispose();
      // Flush the last keystrokes on unbind; the load callback above is
      // cancelled, so a deferred refresh cannot resurrect the old binding.
      controllerRef.current?.flush();
      controllerRef.current = null;
    };
  }, [contributionId, hasSave, workbench, loadKey, props.placement?.instanceId]);

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
  const scrollResetKey = currentLoaded ? `${currentLoaded.loadKey}:${currentLoaded.editorRevision}` : "";

  useLayoutEffect(() => {
    if (!scrollResetKey || sectionNavigation) return;
    const node = rendererRef.current;
    if (!node) return;

    requestAnimationFrame(() => {
      let current = node.parentElement;
      while (current) {
        const overflowY = getComputedStyle(current).overflowY;
        if (["auto", "scroll", "overlay"].includes(overflowY) && current.scrollHeight > current.clientHeight) {
          current.scrollTop = 0;
        }
        current = current.parentElement;
      }
    });
  }, [scrollResetKey, sectionNavigation]);

  const loadError = error?.loadKey === loadKey ? error.message : undefined;
  const retryLoad = () => controllerRef.current?.retryLoad();
  const retrySave = () => controllerRef.current?.retry();

  if (loadError && !currentLoaded) {
    return (
      <Center h="full" minH="0" bg="bg" p="md" flexDirection="column" gap="sm">
        <Text color="fg.muted">{loadError}</Text>
        <Button size="xs" variant="subtle" onClick={retryLoad}>
          Retry
        </Button>
      </Center>
    );
  }

  if (!currentLoaded) {
    return (
      <Center h="full" minH="0" bg="bg">
        <Spinner size="sm" />
      </Center>
    );
  }

  // The key must carry the document identity, not just the contribution: two
  // documents from the same renderer both start at revision 1, so keying on the
  // contribution alone reuses the editor and keeps showing the previous file.
  const editorKey = `${currentLoaded.loadKey}:${currentLoaded.editorRevision}`;
  const errorNotice = loadError ? (
    <FileRendererErrorNotice message={loadError} onRetry={retryLoad} />
  ) : editState.saveError ? (
    <FileRendererErrorNotice message={editState.saveError} onRetry={retrySave} />
  ) : null;

  const handleActiveSectionChange = (sectionId: string | null) => {
    syncActiveFileSection({ workbench, navigation: sectionNavigation, sectionId });
  };

  return (
    <Flex direction="column" h="full" minH="0" bg="bg">
      {currentLoaded.filePath ? (
        <FileRendererPathHeader
          fileName={currentLoaded.fileName ?? currentLoaded.filePath}
          filePath={currentLoaded.filePath}
        />
      ) : null}
      <Box flex="1" minH="0">
        <FileRendererContentView
          content={currentLoaded}
          editorKey={editorKey}
          errorNotice={errorNotice}
          contributionCanSave={Boolean(contribution.save)}
          onActiveSectionChange={sectionNavigation ? handleActiveSectionChange : undefined}
          onChange={handleChange}
          rendererRef={rendererRef}
          sectionNavigation={editorSectionNavigation}
          title={contribution.title}
        />
      </Box>
    </Flex>
  );
};
