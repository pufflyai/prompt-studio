import { siteMetadata } from "../config/site-metadata";
import type { LandingPage } from "../content/landing-pages";
import { landingStructuredData } from "./landing-structured-data";

/** Head metadata for a page, or for the not-found page when `page` is undefined. */
export const landingMetadata = (page: LandingPage | undefined, path: string) => {
  const title = page?.title ?? "Page not found | Prompt Studio";
  const description = page?.description ?? "The requested Prompt Studio page could not be found.";
  const canonicalUrl = new URL(page?.path ?? path, siteMetadata.siteUrl).href;
  const structuredData = page ? landingStructuredData(page, canonicalUrl) : undefined;
  return { title, description, canonicalUrl, structuredData, indexable: Boolean(page) };
};

export const updateLandingMetadata = (page: LandingPage) => {
  const metadata = landingMetadata(page, page.path);
  document.title = metadata.title;
  for (const [selector, content] of [
    ['meta[name="description"]', metadata.description],
    ['meta[property="og:title"]', metadata.title],
    ['meta[property="og:description"]', metadata.description],
    ['meta[property="og:url"]', metadata.canonicalUrl],
    ['meta[name="twitter:title"]', metadata.title],
    ['meta[name="twitter:description"]', metadata.description],
    ['meta[name="twitter:url"]', metadata.canonicalUrl],
  ]) {
    document.querySelector(selector)?.setAttribute("content", content);
  }
  document.querySelector('link[rel="canonical"]')?.setAttribute("href", metadata.canonicalUrl);
  const structuredData = document.querySelector('script[type="application/ld+json"]');
  if (structuredData) structuredData.textContent = JSON.stringify(metadata.structuredData);
};
