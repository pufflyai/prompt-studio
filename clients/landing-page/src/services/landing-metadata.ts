import { siteMetadata } from "../config/site-metadata";
import { landingPageFromPath } from "./landing-route";

export const landingMetadata = (path: string) => {
  const page = landingPageFromPath(path);
  const title = page?.title ?? "Page not found | Prompt Studio";
  const description = page?.description ?? "The requested Prompt Studio page could not be found.";
  const canonicalUrl = new URL(page?.path ?? path, siteMetadata.siteUrl).href;
  const websiteId = `${siteMetadata.siteUrl}/#website`;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": websiteId,
        url: `${siteMetadata.siteUrl}/`,
        name: "Prompt Studio",
        description: siteMetadata.description,
      },
      {
        "@type": "WebPage",
        "@id": canonicalUrl,
        url: canonicalUrl,
        name: title,
        description,
        isPartOf: { "@id": websiteId },
      },
    ],
  };
  return { title, description, canonicalUrl, structuredData, indexable: Boolean(page) };
};

export const updateLandingMetadata = (path: string) => {
  const metadata = landingMetadata(path);
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
