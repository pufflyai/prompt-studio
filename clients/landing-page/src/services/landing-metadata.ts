import { siteMetadata } from "../config/site-metadata";
import type { LandingPage } from "../content/landing-pages";
import { landingStructuredData } from "./landing-structured-data";

/** Head metadata for a page, or for the not-found page when `page` is undefined. */
export const landingMetadata = (page: LandingPage | undefined, path: string) => {
  const title = page?.title ?? "Page not found | Prompt Studio";
  const description = page?.description ?? "The requested Prompt Studio page could not be found.";
  const canonicalUrl = new URL(page?.path ?? path, siteMetadata.siteUrl).href;
  const structuredData = page ? landingStructuredData(page, canonicalUrl) : undefined;
  const image =
    page?.view === "post"
      ? {
          path: page.image.light.src,
          width: page.image.light.width,
          height: page.image.light.height,
          alt: "Watercolor Prompt Studio tool shapes.",
        }
      : siteMetadata.banner;
  const banner = { ...image, url: new URL(image.path, siteMetadata.siteUrl).href };
  return { title, description, canonicalUrl, structuredData, banner, indexable: Boolean(page) };
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
    ['meta[property="og:type"]', page.view === "post" ? "article" : "website"],
    ['meta[property="og:image"]', metadata.banner.url],
    ['meta[property="og:image:width"]', String(metadata.banner.width)],
    ['meta[property="og:image:height"]', String(metadata.banner.height)],
    ['meta[property="og:image:alt"]', metadata.banner.alt],
    ['meta[name="twitter:image"]', metadata.banner.url],
    ['meta[name="twitter:image:alt"]', metadata.banner.alt],
  ]) {
    document.querySelector(selector)?.setAttribute("content", content);
  }
  document.querySelector('link[rel="canonical"]')?.setAttribute("href", metadata.canonicalUrl);
  const structuredData = document.querySelector('script[type="application/ld+json"]');
  if (structuredData) structuredData.textContent = JSON.stringify(metadata.structuredData);
};
