import { type LandingView, SIDEBAR_VIEWS } from "../content/landing-content";

const LANDING_VIEW_PATHS: Record<LandingView, string> = {
  start: "/",
  "what-is-prompt-studio": "/what-is-prompt-studio",
  examples: "/examples",
  features: "/features",
  privacy: "/privacy",
  terms: "/terms",
};

export const landingPathForView = (view: LandingView) => LANDING_VIEW_PATHS[view];

export const nextLandingView = (view: LandingView) => {
  if (view === "privacy") return "terms";
  if (view === "terms") return "start";
  return SIDEBAR_VIEWS[(SIDEBAR_VIEWS.indexOf(view) + 1) % SIDEBAR_VIEWS.length];
};

const normalizePath = (path: string) => {
  const pathname = path.split(/[?#]/)[0];
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "");
};

export const landingViewFromPath = (path: string): LandingView => {
  const pathname = normalizePath(path);
  const match = Object.entries(LANDING_VIEW_PATHS).find(([, candidate]) => candidate === pathname);
  return (match?.[0] as LandingView | undefined) ?? "start";
};

export const ALL_LANDING_PATHS = Object.values(LANDING_VIEW_PATHS);
