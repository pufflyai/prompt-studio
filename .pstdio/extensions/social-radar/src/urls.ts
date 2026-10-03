import { createHash } from "node:crypto";

export const canonicalThreadUrl = (value: string) => {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Use an HTTP or HTTPS thread URL.");
  url.hash = "";
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  const id = url.hostname === "news.ycombinator.com" ? url.searchParams.get("id") : null;
  const video = ["www.youtube.com", "youtube.com", "m.youtube.com"].includes(url.hostname)
    ? url.searchParams.get("v")
    : null;
  url.search = "";
  if (id) url.searchParams.set("id", id);
  if (video) url.searchParams.set("v", video);
  return url.toString().replace(/\/$/, "");
};
export const threadId = (url: string) => createHash("sha256").update(url).digest("hex");
