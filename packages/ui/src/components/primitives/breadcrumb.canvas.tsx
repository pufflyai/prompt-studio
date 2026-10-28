import { Avatar, Box, Button, HStack, Icon, Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { ChevronRight, FileText, Folder, Home, MessageCircle } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Breadcrumb, type BreadcrumbProps } from "@/components/primitives/breadcrumb";

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
const meta: CanvasMeta<typeof Breadcrumb> = {
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
export const Default = {
  id: "components-navigation-breadcrumb--default",
};
const ResourceActionsExample = () => {
  const [title, setTitle] = useState("Meeting notes");
  return (
    <Breadcrumb
      items={[
        { title: "Notes" },
        {
          title,
          contextMenuActions: [
            {
              key: "rename",
              label: "Rename note",
              icon: <FileText size={14} />,
              onClick: () => setTitle("Renamed note"),
            },
          ],
        },
      ]}
      separator="/"
    />
  );
};
export const ResourceActions: CanvasVariant<typeof Breadcrumb> = {
  id: "components-navigation-breadcrumb--resource-actions",
  render: () => <ResourceActionsExample />,
};
export const IconSeparator = {
  id: "components-navigation-breadcrumb--icon-separator",
  args: {
    separator: <Icon as={ChevronRight} boxSize="12px" color="fg.muted" />,
  },
};
export const Narrow = {
  id: "components-navigation-breadcrumb--narrow",
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
export const StaticAncestor = {
  id: "components-navigation-breadcrumb--static-ancestor",
  args: {
    items: [
      {
        title: (
          <>
            <Icon as={Folder} boxSize="14px" />
            Sessions
          </>
        ),
      },
      {
        title: (
          <>
            <Icon as={FileText} boxSize="14px" />
            Current session
          </>
        ),
      },
    ],
  },
};
// A breadcrumb that starts inside a Sidenav level leads with the project crumb, so the user can
// leave the level. The crumb sits next to the breadcrumb, like the project button in the navbar.
export const ProjectCrumb = {
  id: "components-navigation-breadcrumb--project-crumb",
  args: {
    items: [
      {
        title: (
          <>
            <Icon as={MessageCircle} boxSize="14px" />
            Sessions
          </>
        ),
        url: "/sessions",
      },
      {
        title: (
          <>
            <Icon as={MessageCircle} boxSize="14px" />
            Level session
          </>
        ),
      },
    ],
  },
  render: (args: BreadcrumbProps) => (
    <HStack gap="xs" minW="0">
      <Button
        px="xs"
        variant="ghost"
        size="xs"
        minW="0"
        justifyContent="flex-start"
        _hover={{ bg: "bg.menu-item.hover" }}
        _active={{ bg: "bg.menu-item.selected" }}
      >
        <HStack gap="xs" minW="0">
          <Avatar.Root size="2xs">
            <Avatar.Fallback name="Prompt Studio" background="bg.muted" color="fg.muted" />
          </Avatar.Root>
          <Text textStyle="label/S/medium" truncate>
            Prompt Studio
          </Text>
        </HStack>
      </Button>
      <Text aria-hidden="true" color="fg.subtle" flexShrink={0}>
        /
      </Text>
      <Breadcrumb {...args} />
    </HStack>
  ),
};
