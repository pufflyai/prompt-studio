import { useEffect, useState } from "react";
import type { LandingView } from "../content/landing-content";
import type { ToolExampleId } from "../content/tool-examples-content";
import { updateLandingMetadata } from "../services/landing-metadata";
import { landingPageFromPath, landingPathForExample, landingPathForView } from "../services/landing-route";

export const useLandingNavigation = (initialPath: string) => {
  const [path, setPath] = useState(initialPath);
  const page = landingPageFromPath(path)!;
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  useEffect(() => updateLandingMetadata(path), [path]);

  const navigateToPath = (nextPath: string) => {
    setPath(nextPath);
    if (nextPath !== window.location.pathname) window.history.pushState({}, "", nextPath);
  };

  const navigate = (next: LandingView) => navigateToPath(landingPathForView(next));
  const navigateExample = (exampleId: ToolExampleId) => navigateToPath(landingPathForExample(exampleId));

  return { page, navigate, navigateExample, paletteOpen, setPaletteOpen };
};
