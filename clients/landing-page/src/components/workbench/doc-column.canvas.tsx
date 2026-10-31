import { Box } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import darkMedia from "../../content/blog/images/blog-prompt-studio-0-41.png";
import lightMedia from "../../content/blog/images/blog-prompt-studio-0-41-light.png";
import { DocColumn, DocHtml } from "./doc-column";

// Sample markup only. Real legal text lives in the markdown files.
const PRIVACY_HTML = `
<h1>Sample policy</h1>
<p><em>Current as of January 1, 2026</em></p>
<p>This paragraph stands in for an introduction.
A second sentence shows how soft line breaks read.</p>
<h2>A section heading</h2>
<p>Lists render with the document styles:</p>
<ul>
  <li><strong>Bold term</strong> – A definition that follows the term.</li>
  <li><strong>Another term</strong> – A definition with a <a href="https://prompt.studio">link</a>.</li>
</ul>
`;
const TERMS_HTML = `
<h1>Sample terms</h1>
<p><em>Current as of January 1, 2026</em></p>
<h2>A section heading</h2>
<p>A short paragraph of placeholder text.</p>
`;
const meta = {
  title: "Landing/DocColumn",
  component: DocColumn,
  decorators: [
    (Story) => (
      <Box height="640px" bg="bg.subtle" p="panel-gap">
        <Story />
      </Box>
    ),
  ],
} satisfies CanvasMeta<typeof DocColumn>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const PrivacyPolicy: Story = {
  id: "landing-doccolumn--privacy-policy",
  args: { pageKey: "/privacy/", children: <DocHtml html={PRIVACY_HTML} /> },
};
export const TermsOfService: Story = {
  id: "landing-doccolumn--terms-of-service",
  args: { pageKey: "/terms/", children: <DocHtml html={TERMS_HTML} /> },
};
export const HeadingLinks: Story = {
  id: "landing-doccolumn--heading-links",
  args: {
    pageKey: "/heading-links/",
    children: (
      <DocHtml
        html={`
<h1 id="install">Install<a href="#install" data-heading-link aria-label="Link to Install"></a></h1>
<p>Each heading has a section link that can be opened or copied.</p>
<h2 id="desktop">Desktop app<a href="#desktop" data-heading-link aria-label="Link to Desktop app"></a></h2>
<p>Install the desktop app for your computer.</p>
<h2 id="cli">Command-line tool<a href="#cli" data-heading-link aria-label="Link to Command-line tool"></a></h2>
<p>Install the CLI with Bun.</p>
<h3 id="check">Check <code>pst</code><a href="#check" data-heading-link aria-label="Link to Check pst"></a></h3>
<p>Run <code>pst --version</code>.</p>
`}
      />
    ),
  },
};
const THEMED_MEDIA_HTML = `
<h1>Theme-specific media</h1>
<p>The article shows one image and hides the inactive image's paragraph.</p>
<p><img data-art-tone="light" src="${lightMedia}" alt="Light theme media" /></p>
<p><img data-art-tone="dark" src="${darkMedia}" alt="Dark theme media" /></p>
<p><em>One caption stays visible in both themes.</em></p>
`;
export const ThemedMedia: Story = {
  id: "landing-doccolumn--themed-media",
  args: { pageKey: "/themed-media/", children: <DocHtml html={THEMED_MEDIA_HTML} /> },
};
export const ThemedMediaDark: Story = {
  id: "landing-doccolumn--themed-media-dark",
  ...ThemedMedia,
  decorators: [
    (Story) => (
      <Box className="dark">
        <Story />
      </Box>
    ),
  ],
};
