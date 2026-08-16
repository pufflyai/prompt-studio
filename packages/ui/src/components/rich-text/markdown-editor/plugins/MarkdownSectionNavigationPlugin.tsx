import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect, useRef } from "react";
import {
  type MarkdownSectionAnchor,
  matchMarkdownSectionAnchors,
  resolveActiveMarkdownSection,
} from "./markdown-section-navigation";

interface MarkdownSectionNavigationPluginProps {
  anchors: MarkdownSectionAnchor[];
  targetId: string;
  onActiveSectionChange?: (sectionId: string | null) => void;
}

const findScrollContainer = (root: HTMLElement) => {
  let current = root.parentElement;

  while (current) {
    const overflowY = getComputedStyle(current).overflowY;
    if (["auto", "scroll", "overlay"].includes(overflowY)) return current;
    current = current.parentElement;
  }

  return null;
};

export const MarkdownSectionNavigationPlugin = (props: MarkdownSectionNavigationPluginProps) => {
  const { anchors, targetId, onActiveSectionChange } = props;
  const [editor] = useLexicalComposerContext();
  const callbackRef = useRef(onActiveSectionChange);
  callbackRef.current = onActiveSectionChange;

  useEffect(() => {
    let cleanup: () => void = () => {};
    const frame = requestAnimationFrame(() => {
      const root = editor.getRootElement();
      if (!root) return;
      const headingElements = Array.from(root.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6"));
      const matches = matchMarkdownSectionAnchors(
        headingElements.map((heading) => heading.textContent ?? ""),
        anchors,
      );
      const matchedElements = matches.map((match) => ({
        id: match.id,
        element: headingElements[match.headingIndex]!,
      }));

      for (const match of matchedElements) match.element.dataset.markdownSectionId = match.id;

      const target = matchedElements.find((match) => match.id === targetId);
      if (!target) {
        console.warn(`[markdown section] Unknown section id: ${targetId}`);
        callbackRef.current?.(null);
        return;
      }

      target.element.tabIndex = -1;
      target.element.scrollIntoView({ block: "start" });
      target.element.focus({ preventScroll: true });

      const scrollContainer = findScrollContainer(root);
      let previousId: string | undefined;
      const publishActiveSection = () => {
        const containerTop = scrollContainer?.getBoundingClientRect().top ?? 0;
        const activeId = resolveActiveMarkdownSection(
          matchedElements.map((match) => ({
            id: match.id,
            top: match.element.getBoundingClientRect().top - containerTop,
          })),
          8,
        );
        if (!activeId || activeId === previousId) return;
        previousId = activeId;
        callbackRef.current?.(activeId);
      };

      const scrollTarget: HTMLElement | Window = scrollContainer ?? window;
      scrollTarget.addEventListener("scroll", publishActiveSection, { passive: true });
      publishActiveSection();
      cleanup = () => {
        scrollTarget.removeEventListener("scroll", publishActiveSection);
      };
    });

    return () => {
      cancelAnimationFrame(frame);
      cleanup();
    };
  }, [anchors, editor, targetId]);

  return null;
};
