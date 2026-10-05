import { useEffect, useState } from "react";
import type { LandingPage, SiteSection } from "../content/landing-pages";
import { updateLandingMetadata } from "../services/landing-metadata";
import { landingPageFromPath, SECTION_HOME, sectionForPage } from "../services/landing-route";

const isPlainClick = (event: MouseEvent) =>
  !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

export const useLandingNavigation = (initialPath: string, pages: LandingPage[]) => {
  const [path, setPath] = useState(initialPath);
  const page = landingPageFromPath(pages, path)!;
  // The last page read in each title bar tab during this visit. A reload starts fresh.
  const [lastPaths, setLastPaths] = useState(() => ({ ...SECTION_HOME, [sectionForPage(page)]: initialPath }));
  const [paletteOpen, setPaletteOpen] = useState(false);

  const show = (nextPath: string) => {
    const nextPage = landingPageFromPath(pages, nextPath);
    if (!nextPage) return;
    setPath(nextPath);
    setLastPaths((paths) => ({ ...paths, [sectionForPage(nextPage)]: nextPath }));
  };

  const navigate = (href: string) => {
    const url = new URL(href, window.location.href);
    const target = `${url.pathname}${url.hash}`;
    if (target !== `${window.location.pathname}${window.location.hash}`) window.history.pushState({}, "", target);
    show(url.pathname);
  };

  // Every same-site link, including links inside docs HTML, opens without a
  // reload, so the tool scene, window mode, and sidebar width survive.
  // biome-ignore lint/correctness/useExhaustiveDependencies: listeners only call state setters and the fixed page list.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    const onClick = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement) || !isPlainClick(event) || anchor.target || anchor.download) return;
      const url = new URL(anchor.href);
      if (url.origin !== window.location.origin || !landingPageFromPath(pages, url.pathname)) return;
      // A link to a heading on the same page scrolls natively.
      if (url.pathname === window.location.pathname && url.hash) return;
      event.preventDefault();
      navigate(anchor.href);
    };
    const onPopState = () => show(window.location.pathname);
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("click", onClick);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("click", onClick);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  useEffect(() => updateLandingMetadata(page), [page]);

  /** Selecting the open tab returns to its first page; another tab reopens its last page. */
  const sectionPath = (section: SiteSection) =>
    section === sectionForPage(page) ? SECTION_HOME[section] : lastPaths[section];

  return { page, navigate, sectionPath, paletteOpen, setPaletteOpen };
};
