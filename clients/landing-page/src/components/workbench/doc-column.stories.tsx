import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { DocColumn } from "./doc-column";
import { PageNavigation } from "./page-navigation";

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
  args: {
    html: PRIVACY_HTML,
    pageKey: "/privacy/",
    navigation: <PageNavigation view="privacy" placement="document" onNavigate={() => {}} />,
  },
};

export const TermsOfService: Story = {
  args: {
    html: TERMS_HTML,
    pageKey: "/terms/",
    navigation: <PageNavigation view="terms" placement="document" onNavigate={() => {}} />,
  },
};
