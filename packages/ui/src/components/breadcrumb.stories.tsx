import { Box, Icon } from "@chakra-ui/react";
import type { Meta } from "@storybook/react";
import { ChevronRight, FileText, Folder, Home } from "lucide-react";
import type { ReactNode } from "react";

import { Breadcrumb } from "./breadcrumb";

type StoryFn = () => ReactNode;

const items = [
  {
    title: (
      <>
        <Icon as={Home} boxSize="14px" />
        Dashboard
      </>
    ),
    url: "/",
  },
  {
    title: (
      <>
        <Icon as={Folder} boxSize="14px" />
        Invoices
      </>
    ),
    url: "/invoices",
  },
  {
    title: (
      <>
        <Icon as={FileText} boxSize="14px" />
        Northwind Traders Q4 2024
      </>
    ),
  },
];

const meta: Meta<typeof Breadcrumb> = {
  title: "Components/Navigation/Breadcrumb",
  component: Breadcrumb,
  decorators: [
    (Story: StoryFn) => (
      <Box padding="sm" background="bg">
        <Story />
      </Box>
    ),
  ],
  args: {
    items,
    separator: "/",
    separatorGap: "xs",
  },
};

export default meta;

export const Default = {};

export const IconSeparator = {
  args: {
    separator: <Icon as={ChevronRight} boxSize="12px" color="fg.muted" />,
  },
};

export const Narrow = {
  args: {
    items: [
      {
        title: (
          <>
            <Icon as={Folder} boxSize="14px" />
            Projects
          </>
        ),
        url: "/",
      },
      {
        title: (
          <>
            <Icon as={FileText} boxSize="14px" />
            PS-246 Update chat panel styles and responsive properties panel
          </>
        ),
      },
    ],
  },
  decorators: [
    (Story: StoryFn) => (
      <Box padding="sm" background="bg" width="220px">
        <Story />
      </Box>
    ),
  ],
};
