import { spacing } from "../theme/primitives/sizes";

export interface TypographySample {
  label: string;
  textStyle: string;
  description: string;
  sample: string;
}

export interface FontSample {
  label: string;
  role: string;
  fontFamily: string;
  sample: string;
}

export interface ColorSwatch {
  label: string;
  token: string;
  description: string;
  textToken?: string;
  variant?: "fill" | "stroke";
}

export interface ColorGroup {
  title: string;
  description: string;
  swatches: ColorSwatch[];
}

export interface SpacingSample {
  label: string;
  token: string;
  value: string;
  helper: string;
}

export interface RadiusSample {
  label: string;
  token: string;
  helper: string;
}

export const fontSamples: FontSample[] = [
  {
    label: "Display",
    role: "Editorial headlines and hero statements.",
    fontFamily: "display",
    sample: "Playfair Display 012345",
  },
  {
    label: "Heading + Labels",
    role: "UI titles, navigation, and controls.",
    fontFamily: "heading",
    sample: "Onest 012345",
  },
  {
    label: "Body",
    role: "Paragraphs and long-form reading.",
    fontFamily: "body",
    sample: "Inter 012345",
  },
];

export const typographySamples: TypographySample[] = [
  {
    label: "Display L",
    textStyle: "heading/display/L",
    description: "Hero statements and landing headlines.",
    sample: "Automation you can trust",
  },
  {
    label: "Display M",
    textStyle: "heading/display/M",
    description: "Campaign headers and marketing sections.",
    sample: "Mission control for document AI",
  },
  {
    label: "Display S",
    textStyle: "heading/display/S",
    description: "Editorial callouts and sub-hero messaging.",
    sample: "Confidence for every doc",
  },

  {
    label: "Heading XL",
    textStyle: "heading/XL",
    description: "Top-level page titles.",
    sample: "Operations center",
  },
  {
    label: "Heading L",
    textStyle: "heading/L",
    description: "Primary dashboard sections.",
    sample: "Operational overview",
  },
  {
    label: "Heading M",
    textStyle: "heading/M",
    description: "Card titles and panels.",
    sample: "Pipeline performance",
  },
  {
    label: "Heading S",
    textStyle: "heading/S",
    description: "Secondary sections and panels.",
    sample: "Queue insights",
  },

  {
    label: "Brand",
    textStyle: "brand",
    description: "Wordmark accents and brand moments.",
    sample: "Schub",
  },

  {
    label: "Label XL Regular",
    textStyle: "label/XL/regular",
    description: "Oversized labels and hero UI.",
    sample: "Portfolio summary",
  },

  {
    label: "Label L Regular",
    textStyle: "label/L/regular",
    description: "Supporting labels and helper headers.",
    sample: "Source files",
  },
  {
    label: "Label L Medium",
    textStyle: "label/L/medium",
    description: "Buttons, tabs, and key labels.",
    sample: "Workflow status",
  },
  {
    label: "Label L Medium Underline",
    textStyle: "label/L/medium/underline",
    description: "Linked actions and emphasized controls.",
    sample: "View details",
  },
  {
    label: "Label L Medium Uppercase",
    textStyle: "label/L/medium/uppercase",
    description: "Overlines and category markers.",
    sample: "System status",
  },

  {
    label: "Label M Regular",
    textStyle: "label/M/regular",
    description: "Form labels and metadata.",
    sample: "Owner",
  },
  {
    label: "Label M Regular Underline",
    textStyle: "label/M/regular/underline",
    description: "Inline links and actions.",
    sample: "Open report",
  },
  {
    label: "Label M Medium",
    textStyle: "label/M/medium",
    description: "Compact UI labels.",
    sample: "Assigned",
  },

  {
    label: "Label S Regular",
    textStyle: "label/S/regular",
    description: "Secondary metadata and timestamps.",
    sample: "Last updated",
  },
  {
    label: "Label S Medium",
    textStyle: "label/S/medium",
    description: "Tag labels and small controls.",
    sample: "In review",
  },
  {
    label: "Label S Italic",
    textStyle: "label/S/italic",
    description: "Emphasis in microcopy.",
    sample: "Optional",
  },
  {
    label: "Label XS",
    textStyle: "label/XS",
    description: "Captions and helper text.",
    sample: "Updated 2 min ago",
  },

  {
    label: "Paragraph XL Regular",
    textStyle: "paragraph/XL/regular",
    description: "Intro copy and highlights.",
    sample: "Ship compliant automation without slowing teams down.",
  },
  {
    label: "Paragraph XL Medium",
    textStyle: "paragraph/XL/medium",
    description: "Emphasized intro copy.",
    sample: "Trusted automation for teams that cannot wait.",
  },

  {
    label: "Paragraph L Regular",
    textStyle: "paragraph/L/regular",
    description: "Long-form reading and descriptions.",
    sample: "Write clear guidance for reviewers and operators.",
  },
  {
    label: "Paragraph L Medium",
    textStyle: "paragraph/L/medium",
    description: "Highlighted body copy.",
    sample: "Highlight the insight that matters most.",
  },

  {
    label: "Paragraph M Regular",
    textStyle: "paragraph/M/regular",
    description: "Default body copy.",
    sample: "Use clear, concise language across dense data surfaces.",
  },
  {
    label: "Paragraph M Medium",
    textStyle: "paragraph/M/medium",
    description: "Emphasized body text.",
    sample: "Keep status messages short and confident.",
  },
];

export const colorGroups: ColorGroup[] = [
  {
    title: "Surface layers",
    description: "Foundational canvases for pages, cards, and panels.",
    swatches: [
      {
        label: "Background primary",
        token: "bg",
        description: "Default app canvas.",
      },
      {
        label: "Background secondary",
        token: "bg.muted",
        description: "Secondary panels and cards.",
      },
      {
        label: "Background hover",
        token: "bg.hover",
        description: "Hover state for cards and rows.",
      },
      {
        label: "Background subtle",
        token: "bg.subtle",
        description: "Muted surfaces and quiet states.",
      },
      {
        label: "Background active",
        token: "bg.active",
        description: "Selected states and active rows.",
      },
      {
        label: "Background inverse",
        token: "bg.inverted",
        description: "Dark surfaces and overlays.",
        textToken: "fg.inverted",
      },
    ],
  },
  {
    title: "Accent surfaces",
    description: "Accent backgrounds for emphasis and status.",
    swatches: [
      {
        label: "Accent primary light",
        token: "bg.accent-primary.light",
        description: "Primary highlight backgrounds.",
      },
      {
        label: "Accent primary medium",
        token: "bg.accent-primary.medium",
        description: "Hover highlights and banners.",
      },
      {
        label: "Accent primary dark",
        token: "bg.accent-primary.dark",
        description: "Pressed highlights and stronger accent surfaces.",
      },
      {
        label: "Accent blue light",
        token: "bg.accent-secondary.blue-light",
        description: "Informational messaging.",
      },
      {
        label: "Accent red light",
        token: "bg.accent-secondary.red-light",
        description: "Error feedback surfaces.",
      },
      {
        label: "Accent green light",
        token: "bg.accent-secondary.green-light",
        description: "Success feedback surfaces.",
      },
      {
        label: "Accent yellow light",
        token: "bg.accent-secondary.yellow-light",
        description: "Subtle warning and pending surfaces.",
      },
      {
        label: "Accent yellow medium",
        token: "bg.accent-secondary.yellow-medium",
        description: "Warning and pending emphasis surfaces.",
      },
      {
        label: "Accent yellow dark",
        token: "bg.accent-secondary.yellow-dark",
        description: "Stronger warning and pending highlights.",
      },
    ],
  },
  {
    title: "Borders",
    description: "Stroke colors for dividers, cards, and focus rings.",
    swatches: [
      {
        label: "Border primary",
        token: "border",
        description: "High contrast borders.",
        variant: "stroke",
      },
      {
        label: "Border secondary",
        token: "border.muted",
        description: "Default card outlines.",
        variant: "stroke",
      },
      {
        label: "Border accent",
        token: "blue.border",
        description: "Brand focus state.",
        variant: "stroke",
      },
      {
        label: "Border accent light",
        token: "border.accent-light",
        description: "Subtle accent strokes.",
        variant: "stroke",
      },
    ],
  },
];

export const spacingSamples: SpacingSample[] = [
  { label: "2xs", token: "2xs", value: spacing["2xs"].value, helper: "Hairline gaps and tight stacks." },
  { label: "xs", token: "xs", value: spacing.xs.value, helper: "Compact UI padding." },
  { label: "sm", token: "sm", value: spacing.sm.value, helper: "Controls and list spacing." },
  { label: "md", token: "md", value: spacing.md.value, helper: "Default section padding." },
  { label: "lg", token: "lg", value: spacing.lg.value, helper: "Roomy card gutters." },
  { label: "xl", token: "xl", value: spacing.xl.value, helper: "Hero sections and modals." },
  { label: "2xl", token: "2xl", value: spacing["2xl"].value, helper: "Page-level layout gaps." },
];

export const radiusSamples: RadiusSample[] = [
  { label: "2xs", token: "2xs", helper: "Hairline controls." },
  { label: "xs", token: "xs", helper: "Inputs and chips." },
  { label: "sm", token: "sm", helper: "Buttons and cards." },
  { label: "md", token: "md", helper: "Panels and modals." },
  { label: "lg", token: "lg", helper: "Hero cards." },
  { label: "xl", token: "xl", helper: "Display surfaces." },
  { label: "full", token: "full", helper: "Pills and badges." },
];
