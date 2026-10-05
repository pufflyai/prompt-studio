/** Sites the skill knows how to search. Any other channel is read in the browser at its own link. */
export const builtInChannels = [
  { id: "hn", name: "Hacker News", budget: 4, targets: [] },
  {
    id: "reddit",
    name: "Reddit",
    budget: 4,
    targets: ["r/ClaudeAI", "r/ClaudeCode", "r/ChatGPTCoding", "r/AI_Agents", "r/vibecoding"],
  },
  { id: "bluesky", name: "Bluesky", budget: 3, targets: [] },
  { id: "devto", name: "DEV Community", budget: 2, targets: [] },
  { id: "github", name: "GitHub", budget: 2, targets: [] },
  { id: "youtube", name: "YouTube", budget: 2, targets: [] },
  { id: "x", name: "X", budget: 3, targets: [] },
  { id: "linkedin", name: "LinkedIn", budget: 3, targets: [] },
] satisfies { id: string; name: string; budget: number; targets: string[] }[];
// A removed channel's threads stay, so names fall back to the built-in name, then the id.
export const channelNames = (channels: { id: string; name: string }[]) =>
  Object.fromEntries([...builtInChannels, ...channels].map((channel) => [channel.id, channel.name]));

/** How many images and videos one post or reply can carry; `either` means one kind per post. */
export interface MediaRule {
  images: number;
  videos: number;
  either?: boolean;
}

// Limits as each site documents them in 2026. X counts a GIF as its one video.
export const mediaRules: Record<string, MediaRule> = {
  hn: { images: 0, videos: 0 },
  reddit: { images: 20, videos: 1, either: true },
  bluesky: { images: 4, videos: 1, either: true },
  devto: { images: 10, videos: 0 },
  github: { images: 10, videos: 1 },
  youtube: { images: 0, videos: 1 },
  x: { images: 4, videos: 1, either: true },
  linkedin: { images: 20, videos: 1, either: true },
};

// Custom channels publish no media rules, so their posts stay text only.
export const mediaRuleOf = (site: string) => mediaRules[site] ?? { images: 0, videos: 0 };

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
export const postLengthLimits: Record<string, number> = { x: 280, bluesky: 300, linkedin: 3000 };

export const describeMediaRule = (label: string, rule: MediaRule) => {
  if (!rule.images && !rule.videos) return `${label} takes no media.`;
  const images = rule.images ? `up to ${rule.images} image${rule.images === 1 ? "" : "s"}` : "";
  const videos = rule.videos ? `${rule.videos} video` : "";
  const parts = [videos, images].filter(Boolean);
  return `${label} takes ${parts.join(rule.either ? ", or " : " and ")}.`;
};
