import { Box, Center, Flex, Image, Spinner, Text } from "@chakra-ui/react";
import { CodeEditor } from "@pstdio/ui/diff";
import { MarkdownEditor } from "@pstdio/ui/rich-text";
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
import { codeLanguageFor, pickFileKind } from "./file-kind";
import { createFileRendererLoadKey, isCurrentLoadedFile } from "./file-renderer-load-key";

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
  revision: number;
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
  const loadKey = createFileRendererLoadKey({ fileRendererId: contribution.id, resourceUri: resource?.uri });
  const [loaded, setLoaded] = useState<LoadedFile | null>(null);
  const [error, setError] = useState<{ loadKey: string; message: string } | null>(null);
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

  // Re-binding a singleton widget to another resource changes `resource` and reloads.
  useEffect(() => {
    let cancelled = false;
    let revision = 0;
    setError(null);
    setLoaded(null);
    const load = () => {
      Promise.resolve(contribution.load(resource))
        .then((next) => {
          if (cancelled) return;
          revision += 1;
          setError(null);
          setLoaded({ ...next, revision, loadKey });
        })
        .catch((loadError) => {
          if (cancelled) return;
          setError({ loadKey, message: describeError(loadError) });
        });
    };
    load();
    const refreshSubscription = workbench.renderers.onDidRefreshFileRenderer((event) => {
      if (event.fileRendererId === contribution.id) load();
    });
    return () => {
      cancelled = true;
      refreshSubscription.dispose();
    };
  }, [contribution, workbench, resource, loadKey]);

  // Debounced autosave shared by the markdown + code editors. Flushed on unmount
  // and when the tab is hidden so the last keystrokes are never dropped.
  const save = contribution.save;
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!save) return;
    const flush = () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      if (pending.current === null) return;
      const value = pending.current;
      pending.current = null;
      void save(resource, value);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      flush();
    };
  }, [save, resource]);

  const handleChange = (value: string) => {
    if (!save) return;
    pending.current = value;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      if (pending.current === null) return;
      const next = pending.current;
      pending.current = null;
      void save(resource, next);
    }, SAVE_DEBOUNCE_MS);
  };

  const currentLoaded = isCurrentLoadedFile(loaded, loadKey) ? loaded : null;
  const scrollResetKey = currentLoaded ? `${currentLoaded.loadKey}:${currentLoaded.revision}` : "";

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

  if (error?.loadKey === loadKey) {
    return (
      <Center h="full" minH="0" bg="bg" p="md">
        <Text color="fg.muted">{error.message}</Text>
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

  const kind = pickFileKind(currentLoaded.fileName, currentLoaded.mimeType);
  const isEditable = Boolean(save) && kind !== "image";
  const editorKey = `${contribution.id}:${currentLoaded.revision}`;

  const handleActiveSectionChange = (sectionId: string | null) => {
    syncActiveFileSection({ workbench, navigation: sectionNavigation, sectionId });
  };

  if (kind === "image") {
    if (!currentLoaded.dataUrl) {
      return (
        <Center h="full" minH="0" bg="bg" p="md">
          <Text color="fg.muted">This image preview is unavailable.</Text>
        </Center>
      );
    }
    return (
      <Center ref={rendererRef} h="full" minH="0" bg="bg" p="md" overflow="auto">
        <Image
          src={currentLoaded.dataUrl}
          alt={currentLoaded.fileName ?? contribution.title}
          maxW="100%"
          maxH="100%"
          objectFit="contain"
        />
      </Center>
    );
  }

  if (kind === "code") {
    return (
      <Box h="full" minH="0" bg="bg">
        <CodeEditor
          key={editorKey}
          language={codeLanguageFor(currentLoaded.fileName)}
          defaultCode={currentLoaded.content ?? ""}
          isEditable={isEditable}
          showLineNumbers
          onChange={isEditable ? handleChange : undefined}
        />
      </Box>
    );
  }

  return (
    <Flex ref={rendererRef} direction="column" h="full" minH="0" overflow="hidden" bg="bg">
      <Box flex="1" minH="0" overflowY="auto">
        <MarkdownEditor
          key={editorKey}
          defaultState={currentLoaded.content ?? ""}
          isEditable={isEditable}
          sectionNavigation={editorSectionNavigation}
          placeholder={isEditable ? (currentLoaded.placeholder ?? "Write…") : undefined}
          onActiveSectionChange={sectionNavigation ? handleActiveSectionChange : undefined}
          onChange={isEditable ? handleChange : undefined}
        />
      </Box>
    </Flex>
  );
};
