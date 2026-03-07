import { siteMetadata } from "@/config/site-metadata";

interface SeoMetadataOverrides {
  title?: string;
  description?: string;
  pathname?: string;
  banner?: string;
}

const buildAbsoluteUrl = (path: string) => {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  return `${siteMetadata.siteUrl}${path}`;
};

export const createSeoMetadata = (overrides: SeoMetadataOverrides = {}) => {
  const { title, description, pathname, banner } = overrides;
  const safePathname = pathname ?? "";

  return {
    title: title ?? siteMetadata.title,
    description: description ?? siteMetadata.description,
    keywords: siteMetadata.keywords.join(", "),
    url: `${siteMetadata.siteUrl}${safePathname}`,
    twitterUsername: siteMetadata.twitterUsername,
    banner: buildAbsoluteUrl(banner ?? siteMetadata.bannerPath),
    faviconSvgUrl: buildAbsoluteUrl(siteMetadata.faviconSvgPath),
    faviconPngUrl: buildAbsoluteUrl(siteMetadata.faviconPngPath),
  };
};
