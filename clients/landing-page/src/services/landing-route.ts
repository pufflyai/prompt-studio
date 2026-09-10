import { type LandingView, SIDEBAR_VIEWS } from "../content/landing-content";
import { LANDING_PAGES } from "../content/landing-pages";
import type { ToolExampleId } from "../content/tool-examples-content";

export const landingPathForView = (view: LandingView) => LANDING_PAGES.find((page) => page.view === view)!.path;

export const landingPathForExample = (exampleId: ToolExampleId) =>
  LANDING_PAGES.find((page) => page.exampleId === exampleId)!.path;

export const nextLandingView = (view: LandingView) => {
  if (view === "privacy") return "terms";
  if (view === "terms") return "start";
  return SIDEBAR_VIEWS[(SIDEBAR_VIEWS.indexOf(view) + 1) % SIDEBAR_VIEWS.length];
};

export const previousLandingView = (view: LandingView) => {
  if (view === "start") return null;
  if (view === "privacy") return "start";
  if (view === "terms") return "privacy";
  return SIDEBAR_VIEWS[SIDEBAR_VIEWS.indexOf(view) - 1];
};

export const landingPageFromPath = (path: string) => {
  const pathname = `${path.split(/[?#]/)[0].replace(/\/+$/, "")}/`;
  if (pathname === "/examples/") return LANDING_PAGES.find((page) => page.view === "examples");
  return LANDING_PAGES.find((page) => page.path === pathname);
};

export const ALL_LANDING_PATHS = [...LANDING_PAGES.map((page) => page.path), "/examples/"];
