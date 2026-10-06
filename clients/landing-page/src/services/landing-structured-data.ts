import { siteMetadata } from "../config/site-metadata";
import type { LandingPage } from "../content/landing-pages";
import { DESKTOP_RELEASES_URL } from "./desktop-releases";

const websiteId = `${siteMetadata.siteUrl}/#website`;
const organizationId = `${siteMetadata.siteUrl}/#organization`;
const applicationId = `${siteMetadata.siteUrl}/#application`;

const organization = {
  "@type": "Organization",
  "@id": organizationId,
  name: "Pufflig AB",
  url: `${siteMetadata.siteUrl}/`,
  logo: new URL(siteMetadata.appleTouchIconPath, siteMetadata.siteUrl).href,
};

const website = {
  "@type": "WebSite",
  "@id": websiteId,
  url: `${siteMetadata.siteUrl}/`,
  name: "Prompt Studio",
  description: siteMetadata.description,
  publisher: { "@id": organizationId },
};

// Only the start page describes the downloadable app. Other pages are documents
// about it, so they must not claim to be a second application.
const application = {
  "@type": "SoftwareApplication",
  "@id": applicationId,
  name: "Prompt Studio",
  description: siteMetadata.description,
  applicationCategory: "DeveloperApplication",
  operatingSystem: "macOS, Windows, Linux",
  url: `${siteMetadata.siteUrl}/`,
  downloadUrl: DESKTOP_RELEASES_URL,
  codeRepository: siteMetadata.repositoryUrl,
  license: `${siteMetadata.repositoryUrl}/blob/main/LICENSE`,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  publisher: { "@id": organizationId },
};

// Posts are articles with an author and a date; the blog index is the blog itself.
const pageType = (page: LandingPage) => {
  if (page.view === "post") return "BlogPosting";
  if (page.view === "blog") return "Blog";
  return "WebPage";
};

export const landingStructuredData = (page: LandingPage, canonicalUrl: string) => {
  const home = page.path === "/";
  const webPage = {
    "@type": pageType(page),
    "@id": canonicalUrl,
    url: canonicalUrl,
    name: page.title,
    description: page.description,
    isPartOf: { "@id": websiteId },
    ...(home ? { about: { "@id": applicationId } } : {}),
    ...(page.view === "post"
      ? {
          headline: page.label,
          datePublished: page.published,
          author: {
            "@type": "Person",
            name: page.author.name,
            ...(page.author.avatarSrc ? { image: new URL(page.author.avatarSrc, siteMetadata.siteUrl).href } : {}),
          },
          timeRequired: `PT${page.readingMinutes}M`,
          publisher: { "@id": organizationId },
          image: new URL(page.image.light.src, siteMetadata.siteUrl).href,
        }
      : {}),
  };

  return {
    "@context": "https://schema.org",
    "@graph": home ? [organization, website, webPage, application] : [organization, website, webPage],
  };
};
