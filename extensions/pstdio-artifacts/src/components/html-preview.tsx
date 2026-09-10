import { Box } from "@chakra-ui/react";
import { useEffect, useRef } from "react";
import { previewDocument } from "./html-preview-document";
import { postPreviewTheme } from "./html-preview-theme";

export interface HtmlPreviewProps {
  html: string;
  title: string;
}

/** Execute an artifact without granting it the extension's origin or host bridge. */
export const HtmlPreview = (props: HtmlPreviewProps) => {
  const { html, title } = props;
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    postPreviewTheme(frame.current, title);
    const observer = new MutationObserver(() => postPreviewTheme(frame.current, title));
    observer.observe(window.document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme", "data-color-mode"],
    });
    return () => observer.disconnect();
  }, [title]);
  return (
    <Box asChild width="full" height="full" minHeight="0" border="none" bg="bg">
      <iframe
        ref={frame}
        title={title}
        srcDoc={previewDocument(html)}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        onLoad={() => postPreviewTheme(frame.current, title)}
      />
    </Box>
  );
};
