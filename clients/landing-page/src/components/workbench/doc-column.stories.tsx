import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
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
} satisfies Meta<typeof DocColumn>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PrivacyPolicy: Story = {
  args: { pageKey: "/privacy/", children: <DocHtml html={PRIVACY_HTML} /> },
};

export const TermsOfService: Story = {
  args: { pageKey: "/terms/", children: <DocHtml html={TERMS_HTML} /> },
};

const THEMED_MEDIA_HTML = `
<h1>Theme-specific media</h1>
<p>The article shows one image and hides the inactive image's paragraph.</p>
<p><img data-art-tone="light" src="${lightMedia}" alt="Light theme media" /></p>
<p><img data-art-tone="dark" src="${darkMedia}" alt="Dark theme media" /></p>
<p><em>One caption stays visible in both themes.</em></p>
`;

export const ThemedMedia: Story = {
  args: { pageKey: "/themed-media/", children: <DocHtml html={THEMED_MEDIA_HTML} /> },
};

export const ThemedMediaDark: Story = {
  ...ThemedMedia,
  decorators: [
    (Story) => (
      <Box className="dark">
        <Story />
      </Box>
    ),
  ],
};
