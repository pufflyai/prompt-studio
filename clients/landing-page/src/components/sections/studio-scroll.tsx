import { Box, Text, useSlotRecipe } from "@chakra-ui/react";
import { useEffect, useRef } from "react";
import type { SidebarView } from "../../content/landing-content";
import { LANDING_PAGES, type LandingPage } from "../../content/landing-pages";
import { TOOL_EXAMPLES, type ToolExampleId } from "../../content/tool-examples-content";
import { useLandingStyles } from "../../hooks/use-landing-styles";
import { ExamplesPage, FeaturesPage, WhatIsPage } from "../../services/landing-modules";
import { landingPageFromPath, landingPathForExample, landingPathForView } from "../../services/landing-route";
import { landingChaptersSlotRecipe } from "../../theme/recipes/landing-chapters";
import { DownloadPicker } from "../downloads/download-picker";
import { PageScroll } from "../workbench/page-scroll";
import { StartHereView } from "./start-here-view";

export type StudioPage = LandingPage & { view: SidebarView };

const SECTIONS: SidebarView[] = ["start", "what-is-prompt-studio", "examples", "features"];
const PIN_RELEASE = ["wheel", "touchstart", "pointerdown"] as const;
// A scroll the page started itself counts as finished once no scroll event came for this long.
const SETTLE_MS = 160;

/** Docs and Blog links keep the Studio on screen while their page loads; the scroll must not undo them. */
const onStudioPath = () =>
  SECTIONS.includes(landingPageFromPath(LANDING_PAGES, window.location.pathname)?.view as SidebarView);

interface StudioScrollProps {
  page: StudioPage;
  onNavigate: (path: string, replace?: boolean) => void;
}

/**
 * Home, What is, Examples and Features read as one scroll. Opening a Studio URL scrolls to its
 * section; scrolling moves the sidebar selection and the URL along with the section in view.
 */
export const StudioScroll = (props: StudioScrollProps) => {
  const { page, onNavigate } = props;
  const styles = useLandingStyles();
  const chapters = useSlotRecipe({ recipe: landingChaptersSlotRecipe })({});
  const panelRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  // The section the visitor is looking at; navigation to it does not scroll.
  const inView = useRef<SidebarView | null>(null);
  // While a deep link holds its section in place, the selection does not follow the scroll.
  const pinned = useRef(false);
  // While the page scrolls to a section itself, the selection waits for it to arrive.
  const gliding = useRef(false);
  const settle = useRef(0);
  const example = useRef<ToolExampleId>(page.view === "examples" ? page.exampleId : TOOL_EXAMPLES[0].id);
  if (page.view === "examples") example.current = page.exampleId;
  const navigateRef = useRef(onNavigate);
  navigateRef.current = onNavigate;

  const sectionTop = (view: SidebarView) => {
    const viewport = viewportRef.current!;
    const el = viewport.querySelector<HTMLElement>(`[data-studio-section="${view}"]`);
    if (!el) return 0;
    return el.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop;
  };

  /** Selects the section that covers the upper part of the screen. */
  const follow = () => {
    const viewport = viewportRef.current;
    if (!viewport || pinned.current || !onStudioPath()) return;
    const line = viewport.scrollTop + viewport.clientHeight * 0.4;
    const current = SECTIONS.filter((view) => sectionTop(view) <= line).at(-1) ?? "start";
    if (current === inView.current) return;
    inView.current = current;
    navigateRef.current(
      current === "examples" ? landingPathForExample(example.current) : landingPathForView(current),
      true,
    );
  };
  const waitForGlide = () => {
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      gliding.current = false;
      follow();
    }, SETTLE_MS);
  };

  // The first screen is exactly one viewport tall, whatever the window size.
  useEffect(() => {
    const viewport = viewportRef.current!;
    const resize = new ResizeObserver(() =>
      panelRef.current!.style.setProperty("--studio-viewport", `${viewport.clientHeight}px`),
    );
    resize.observe(viewport);
    return () => resize.disconnect();
  }, []);

  // Scroll to the page's section, unless it is the one already in view (the URL followed the scroll).
  // biome-ignore lint/correctness/useExhaustiveDependencies: `sectionTop` only reads refs.
  useEffect(() => {
    if (inView.current === page.view) return;
    const first = inView.current === null;
    inView.current = page.view;
    const viewport = viewportRef.current!;
    const go = (behavior: ScrollBehavior) => viewport.scrollTo({ top: sectionTop(page.view), behavior });
    if (!first) {
      gliding.current = true;
      waitForGlide();
    }
    go(first ? "auto" : "smooth");
    if (!first || page.view === "start") return;
    // A deep link lands before the scenes above size themselves; keep the section in place until
    // they settle or the visitor scrolls.
    const resize = new ResizeObserver(() => go("auto"));
    resize.observe(viewport.firstElementChild!);
    pinned.current = true;
    // The scrollbar sits beside the viewport, so listen on the whole scroll area.
    const area = viewport.parentElement!;
    const stop = () => {
      if (!pinned.current) return;
      pinned.current = false;
      resize.disconnect();
      for (const type of PIN_RELEASE) area.removeEventListener(type, stop);
      window.removeEventListener("keydown", stop);
      viewport.dispatchEvent(new Event("scroll"));
    };
    for (const type of PIN_RELEASE) area.addEventListener(type, stop, { passive: true });
    window.addEventListener("keydown", stop);
    const timer = window.setTimeout(stop, 2500);
    return () => {
      window.clearTimeout(timer);
      stop();
    };
  }, [page.view]);

  // Scrolling moves the selection; a scroll the page started waits until it arrives.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `follow` and `waitForGlide` only read refs.
  useEffect(() => {
    const viewport = viewportRef.current!;
    const onScroll = () => (gliding.current ? waitForGlide() : follow());
    viewport.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      viewport.removeEventListener("scroll", onScroll);
      window.clearTimeout(settle.current);
    };
  }, []);

  return (
    <Box ref={panelRef} css={styles.hero}>
      <PageScroll viewportRef={viewportRef}>
        <StartHereView />
        <WhatIsPage.Component />
        <ExamplesPage.Component
          exampleId={example.current}
          onNavigate={(exampleId, replace) => {
            example.current = exampleId;
            onNavigate(landingPathForExample(exampleId), replace);
          }}
        />
        <FeaturesPage.Component />
        <Box css={chapters.page} pt="0">
          <Box css={chapters.cta}>
            <Text as="h2" textStyle={{ base: "heading/M", md: "heading/L" }}>
              Try the agentic workbench.
            </Text>
            <DownloadPicker />
          </Box>
        </Box>
      </PageScroll>
    </Box>
  );
};
