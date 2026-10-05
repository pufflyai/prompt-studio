import type { Site } from "./schemas";

export const siteLabels: Record<Site, string> = {
  hn: "Hacker News",
  reddit: "Reddit",
  bluesky: "Bluesky",
  devto: "DEV Community",
  github: "GitHub",
  youtube: "YouTube",
  x: "X",
  linkedin: "LinkedIn",
};

/** How many images and videos one post or reply can carry; `either` means one kind per post. */
export interface MediaRule {
  images: number;
  videos: number;
  either?: boolean;
}

// Limits as each site documents them in 2026. X counts a GIF as its one video.
export const mediaRules: Record<Site, MediaRule> = {
  hn: { images: 0, videos: 0 },
  reddit: { images: 20, videos: 1, either: true },
  bluesky: { images: 4, videos: 1, either: true },
  devto: { images: 10, videos: 0 },
  github: { images: 10, videos: 1 },
  youtube: { images: 0, videos: 1 },
  x: { images: 4, videos: 1, either: true },
  linkedin: { images: 20, videos: 1, either: true },
};

const imageTypes = ["png", "jpg", "jpeg", "webp"];
const videoTypes = ["gif", "mp4", "mov", "webm"];

export const mediaType = (path: string) => {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  if (imageTypes.includes(extension)) return "image";
  if (videoTypes.includes(extension)) return "video";
  return null;
};

export const mediaFits = (rule: MediaRule, paths: string[]) => {
  const images = paths.filter((path) => mediaType(path) === "image").length;
  const videos = paths.filter((path) => mediaType(path) === "video").length;
  if (rule.either && images > 0 && videos > 0) return false;
  return images <= rule.images && videos <= rule.videos;
};

// Character limits for a post's text; sites without a small limit have none.
export const postLengthLimits: Partial<Record<Site, number>> = { x: 280, bluesky: 300, linkedin: 3000 };

export const describeMediaRule = (site: Site, rule: MediaRule) => {
  const label = siteLabels[site];
  if (!rule.images && !rule.videos) return `${label} takes no media.`;
  const images = rule.images ? `up to ${rule.images} image${rule.images === 1 ? "" : "s"}` : "";
  const videos = rule.videos ? `${rule.videos} video` : "";
  const parts = [videos, images].filter(Boolean);
  return `${label} takes ${parts.join(rule.either ? ", or " : " and ")}.`;
};
