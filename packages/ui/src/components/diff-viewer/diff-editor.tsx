import { DiffModeEnum, DiffView } from "@git-diff-view/react";
import "@git-diff-view/react/styles/diff-view.css";
import { Box } from "@chakra-ui/react";
import { useRef } from "react";
import { buildDiffViewData, type DiffViewData } from "./diff-view-adapter";

export interface DiffEditorInput {
  original: string;
  modified: string;
  language?: string;
  oldPath?: string;
  newPath?: string;
}

interface DiffEditorProps extends DiffEditorInput {
  sideBySide?: boolean;
  disableScroll?: boolean;
  data?: DiffViewData;
}

export interface DiffEditorDataState {
  input: DiffEditorInput;
  data: DiffViewData;
}

const areDiffEditorInputsEqual = (current: DiffEditorInput, next: DiffEditorInput) =>
  current.original === next.original &&
  current.modified === next.modified &&
  current.language === next.language &&
  current.oldPath === next.oldPath &&
  current.newPath === next.newPath;

export const resolveDiffEditorDataState = (
  current: DiffEditorDataState | null,
  input: DiffEditorInput,
  createData: () => DiffViewData,
) => {
  if (current && areDiffEditorInputsEqual(current.input, input)) {
    return current;
  }

  return {
    input,
    data: createData(),
  };
};

export function DiffEditor(props: DiffEditorProps) {
  const { original, modified, language, oldPath, newPath, sideBySide = false, disableScroll = true, data } = props;
  const dataStateRef = useRef<DiffEditorDataState | null>(null);
  const input = { original, modified, language, oldPath, newPath };

  dataStateRef.current = resolveDiffEditorDataState(
    dataStateRef.current,
    input,
    () =>
      data ??
      buildDiffViewData({
        original,
        modified,
        language,
        oldPath,
        newPath,
      }),
  );

  const mode = sideBySide ? DiffModeEnum.Split : DiffModeEnum.Unified;

  return (
    <Box
      height="100%"
      width="100%"
      position="relative"
      zIndex="0"
      overflow={disableScroll ? "hidden" : "auto"}
      bg="bg"
      css={{
        "& .gdv-root, & .gdv-view, & .gdv-file, & .gdv-content, & .gdv-hunk, & .gdv-line": {
          background: "var(--chakra-colors-bg)",
        },
        "& .gdv-root": {
          border: "none",
          borderRadius: "0",
        },
        "& .gdv-line-number": {
          fontSize: "11px",
        },
      }}
    >
      <DiffView
        data={dataStateRef.current.data}
        diffViewMode={mode}
        diffViewTheme="dark"
        diffViewHighlight={true}
        // No wrap: keeps every line one fixed-height row so the virtualizer's height estimate
        // stays exact, and avoids wrapped lines being misread. Long lines scroll horizontally
        // inside DiffView's own overflow-x container.
        diffViewWrap={false}
        diffViewFontSize={11}
      />
    </Box>
  );
}
