import { siteMetadata } from "../config/site-metadata";
import { SITE_LINKS } from "../content/landing-content";
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
  codeRepository: SITE_LINKS.github,
  license: `${SITE_LINKS.github}/blob/main/LICENSE`,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  publisher: { "@id": organizationId },
};

interface LandingStructuredDataInput {
  title: string;
  description: string;
  canonicalUrl: string;
  home: boolean;
}

export const landingStructuredData = (input: LandingStructuredDataInput) => {
  const { title, description, canonicalUrl, home } = input;
  const webPage = {
    "@type": "WebPage",
    "@id": canonicalUrl,
    url: canonicalUrl,
    name: title,
    description,
    isPartOf: { "@id": websiteId },
    ...(home ? { about: { "@id": applicationId } } : {}),
  };

  return {
    "@context": "https://schema.org",
    "@graph": home ? [organization, website, webPage, application] : [organization, website, webPage],
  };
};
