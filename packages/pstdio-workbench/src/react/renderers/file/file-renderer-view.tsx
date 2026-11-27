import { Box, Button, Center, Flex, Text } from "@chakra-ui/react";
import { useRef } from "react";
import type {
  RegisteredFileRendererContribution,
  WorkbenchCore,
  WorkbenchPanelInstance,
  WorkbenchPanelRenderInput,
} from "../../../core";
import { getWorkbenchRenderers } from "../../../core";
import {
  getFileSectionNavigation,
  resolveFileSectionTargetId,
} from "../../../core/registries/renderers/file-section-navigation";
import { useOpenPlacementIds } from "../../shared/use-open-placement-ids";
import { usePageParams } from "../use-page-params";
import { getNativeMarkdownConnection, getPublicMarkdownConnection } from "./file-renderer-connections";
import { FileRendererContentView } from "./file-renderer-content";
import { createFileRendererLoadKey, isCurrentLoadedFile } from "./file-renderer-load-key";
import type { LoadedFile } from "./file-renderer-load-state";
import { FileRendererPathHeader } from "./file-renderer-path-header";
import { useFileSectionSelection } from "./file-renderer-sections";
import { FileRendererStatusNotice } from "./file-renderer-status-notice";
import { SelectedTextEditor } from "./selected-text-editor";
import { useFileRendererAuthority } from "./use-file-renderer-authority";
import { useFileRendererBinding } from "./use-file-renderer-binding";

interface WorkbenchFileRendererViewProps {
  workbench: WorkbenchCore;
  contribution: RegisteredFileRendererContribution;
  // The bound resource (e.g. the open ticket / ticket-file) the load/save
  // commands operate on.
  placement?: WorkbenchPanelInstance;
  presentationInput?: WorkbenchPanelRenderInput;
}
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
  const scopeIdentity = [queryScope.projectId, queryScope.extensionId, resource?.device?.ownerId, resource?.device?.id];
  const cacheKey = `${documentKey}:${JSON.stringify(scopeIdentity)}`;
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
          focusOnOpen={(editor) => {
            const panelRegion = props.presentationInput?.panel.region;
            const region = editor.closest("[data-workbench-focus-region]");
            const active = editor.ownerDocument.activeElement;
            return (
              open &&
              props.presentationInput?.visible !== false &&
              workbench.activation.isActive() &&
              !workbench.keyboard.store.getState().active &&
              workbench.focus.getActiveRegion() === panelRegion &&
              region?.getAttribute("data-workbench-focus-region") === panelRegion &&
              (active === region || active === editor.ownerDocument.body)
            );
          }}
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
