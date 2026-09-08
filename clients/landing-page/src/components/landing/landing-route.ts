import type { LandingView } from "./landing-content";

const LANDING_VIEW_PATHS: Record<LandingView, string> = {
  start: "/",
  "why-prompt-studio": "/why-prompt-studio",
  features: "/features",
  privacy: "/privacy",
  terms: "/terms",
};

export const landingPathForView = (view: LandingView) => LANDING_VIEW_PATHS[view];

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
