import { DiffModeEnum, DiffView } from "@git-diff-view/react";
import "@git-diff-view/react/styles/diff-view.css";
import { Box } from "@chakra-ui/react";
import { buildDiffViewData } from "./diff-view-adapter";

interface DiffEditorProps {
  original: string;
  modified: string;
  language?: string;
  oldPath?: string;
  newPath?: string;
  sideBySide?: boolean;
  disableScroll?: boolean;
}

export function DiffEditor(props: DiffEditorProps) {
  const { original, modified, language, oldPath, newPath, sideBySide = false, disableScroll = true } = props;

  const data = buildDiffViewData({
    original,
    modified,
    language,
    oldPath,
    newPath,
  });

  const mode = sideBySide ? DiffModeEnum.Split : DiffModeEnum.Unified;

  return (
    <Box
      height="100%"
      width="100%"
      overflow={disableScroll ? "hidden" : "auto"}
      css={{
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
        data={data}
        diffViewMode={mode}
        diffViewTheme="dark"
        diffViewHighlight={true}
        diffViewWrap={true}
        diffViewFontSize={11}
      />
    </Box>
  );
}
