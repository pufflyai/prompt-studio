import { Box, Button, HStack, Icon, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { FileText, Plus, Settings, Ticket, Trash2 } from "lucide-react";
import { ListRow } from "./list-row/list-row";

const cornerFocusCss = {
  "& .corner-focus-target": {
    "--corner-focus-color": "var(--chakra-colors-blue-500)",
    "--corner-focus-size": "14px",
    "--corner-focus-width": "2px",
    position: "relative",
    isolation: "isolate",
    outline: "none",
  },
  "& .corner-focus-target::after": {
    content: '""',
    position: "absolute",
    inset: "calc(-1 * var(--corner-focus-width))",
    pointerEvents: "none",
    opacity: 0,
    transition: "opacity 120ms ease",
    background:
      "linear-gradient(var(--corner-focus-color) 0 0) left top / var(--corner-focus-size) var(--corner-focus-width) no-repeat, linear-gradient(var(--corner-focus-color) 0 0) left top / var(--corner-focus-width) var(--corner-focus-size) no-repeat, linear-gradient(var(--corner-focus-color) 0 0) right top / var(--corner-focus-size) var(--corner-focus-width) no-repeat, linear-gradient(var(--corner-focus-color) 0 0) right top / var(--corner-focus-width) var(--corner-focus-size) no-repeat, linear-gradient(var(--corner-focus-color) 0 0) left bottom / var(--corner-focus-size) var(--corner-focus-width) no-repeat, linear-gradient(var(--corner-focus-color) 0 0) left bottom / var(--corner-focus-width) var(--corner-focus-size) no-repeat, linear-gradient(var(--corner-focus-color) 0 0) right bottom / var(--corner-focus-size) var(--corner-focus-width) no-repeat, linear-gradient(var(--corner-focus-color) 0 0) right bottom / var(--corner-focus-width) var(--corner-focus-size) no-repeat",
  },
  "& .corner-focus-target:focus-visible": {
    outline: "none",
    boxShadow: "none",
  },
  "& .corner-focus-target:focus-visible::after, & .corner-focus-target[data-preview-focus=true]::after": {
    opacity: 1,
  },
  "& .corner-focus-target[data-preview-focus=true]": {
    boxShadow: "none",
  },
};

const meta: Meta = {
  title: "Experiments/Corner Focus",
  decorators: [
    (Story) => (
      <Box padding="lg" background="bg" minH="100vh" css={cornerFocusCss}>
        <Story />
      </Box>
    ),
  ],
};

export default meta;
type Story = StoryObj;

export const ButtonsAndListRows: Story = {
  render: () => (
    <Stack gap="xl" maxW="48rem">
      <Stack gap="xs">
        <Text textStyle="label/L/medium">Corner focus treatment</Text>
        <Text textStyle="label/S/regular" color="fg.muted">
          Tab through the controls to compare a visible-corner focus indicator against the default outline. Preview
          items show the focused state without needing keyboard focus.
        </Text>
      </Stack>

      <SimpleGrid columns={{ base: 1, md: 2 }} gap="lg">
        <Stack gap="sm">
          <Text textStyle="label/M/medium">Buttons</Text>
          <HStack gap="sm" flexWrap="wrap">
            <Button className="corner-focus-target" variant="primary">
              Create ticket
            </Button>
            <Button className="corner-focus-target" variant="outline">
              Open workspace
            </Button>
            <Button className="corner-focus-target" variant="ghost">
              <Icon as={Settings} />
              Configure
            </Button>
          </HStack>
          <HStack gap="sm" flexWrap="wrap">
            <Button className="corner-focus-target" data-preview-focus="true" variant="primary">
              Preview focus
            </Button>
            <Button className="corner-focus-target" data-preview-focus="true" variant="outline">
              <Icon as={Plus} />
              New item
            </Button>
          </HStack>
        </Stack>

        <Stack gap="sm">
          <Text textStyle="label/M/medium">List rows</Text>
          <Stack gap="2xs" borderWidth="1px" borderColor="border.muted" padding="xs" maxW="22rem">
            <ListRow id="overview" label="Overview" icon={<FileText size={14} />} className="corner-focus-target" />
            <ListRow
              id="ticket"
              label="Ship corner focus exploration"
              description="PS-65"
              icon={<Ticket size={14} />}
              className="corner-focus-target"
              data-preview-focus="true"
            />
            <ListRow
              id="delete"
              label="Delete workspace"
              icon={<Trash2 size={14} />}
              tone="danger"
              className="corner-focus-target"
            />
          </Stack>
        </Stack>
      </SimpleGrid>
    </Stack>
  ),
};
