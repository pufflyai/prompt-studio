import { useEffect, useState } from "react";
import type { LandingView } from "../content/landing-content";
import { landingPathForView, landingViewFromPath } from "../services/landing-route";

export const useLandingNavigation = (initialPath: string) => {
  const [view, setView] = useState(() => landingViewFromPath(initialPath));
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    const onPopState = () => setView(landingViewFromPath(window.location.pathname));
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  const navigate = (next: LandingView) => {
    const path = landingPathForView(next);
    setView(next);
    if (path !== window.location.pathname) window.history.pushState({}, "", path);
  };

  return { view, navigate, paletteOpen, setPaletteOpen };
};
