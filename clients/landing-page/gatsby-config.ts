import type { GatsbyConfig } from "gatsby";
import { siteMetadata } from "./src/config/site-metadata";

const config: GatsbyConfig = {
  siteMetadata: {
    title: siteMetadata.title,
    siteUrl: siteMetadata.siteUrl,
    favicon_svg: siteMetadata.faviconSvgPath,
    favicon_png: siteMetadata.faviconPngPath,
    twitterUsername: siteMetadata.twitterUsername,
    banner: siteMetadata.bannerPath,
    description: siteMetadata.description,
  },
  plugins: [
    {
      resolve: "gatsby-plugin-manifest",
      options: {
        lang: `en`,
        name: `Prompt Studio`,
        short_name: `Prompt Studio`,
        description: "Plan, delegate, and manage tasks for your AI coding agents.",
        icon: "./static/images/favicon.svg",
        icon_options: {
          purpose: `any maskable`,
        },
        background_color: `#f4f2ec`,
        theme_color: `#0A0D15`,
      },
    },
    `gatsby-plugin-image`,
    {
      resolve: `gatsby-plugin-sharp`,
      options: {
        defaults: {
          placeholder: `none`,
          backgroundColor: `transparent`,
        },
      },
    },
    `gatsby-transformer-sharp`,
    `gatsby-plugin-smoothscroll`,
  ],
  // needed to avoid "React is not defined" error
  jsxRuntime: "automatic",
};

export default config;
