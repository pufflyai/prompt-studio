import { Box, Flex, HStack, IconButton, Input, Stack, Tabs, Text, Textarea } from "@chakra-ui/react";
import type { CanvasMeta } from "@pstdio/canvas";
import { Breadcrumb, Header, ScopedPopover as Popover, Portal, Tooltip, TreeList } from "@pstdio/ui";
import { useRef, useState } from "react";
import { WorkbenchIcon } from "../../react/shared/icon";

const paths = ["README.md", "src/index.ts", "src/app.tsx", "package.json"];
const initialCode = "export const ready = true;\n";

export default {
  title: "Proposals/PS-277 Workspace page tabs",
  description:
    "Exploration only. Workspace is a page with fixed Files/Changes tabs in a short menu header. No tab dragging, dropping or closing. Files opens left by default; Properties and Activity open right. Use Narrow in the frame controls to explore floating menus. Editor state survives switching tabs.",
  fullscreen: true,
  args: { narrow: false },
  controls: { narrow: { type: "boolean" } },
} satisfies CanvasMeta;

export const WorkspacePage = ({ narrow = false }: { narrow?: boolean }) => {
  const [tab, setTab] = useState("files");
  const [filesOpen, setFilesOpen] = useState(true);
  const [right, setRight] = useState<"properties" | "activity">();
  const [filter, setFilter] = useState("");
  const [branch, setBranch] = useState("workspace/menu-header");
  const [comment, setComment] = useState("");
  const [selected, setSelected] = useState("src/index.ts");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const draft = drafts[selected] ?? (selected.endsWith(".md") ? "# Workspace notes\n" : initialCode);
  const bounds = useRef<HTMLDivElement>(null);
  const tree = (
    <TreeList
      activeNodeId={selected}
      sections={[
        {
          id: "files",
          nodes: paths
            .filter((path) => path.includes(filter))
            .map((path) => ({
              id: path,
              label: path,
              icon: <WorkbenchIcon name={path.endsWith(".md") ? "FileText" : "FileCode"} />,
              isNavigable: true,
              rowVariant: "file" as const,
            })),
        },
      ]}
      onNavigate={({ nodeId }) => {
        setSelected(nodeId);
        setTab("files");
      }}
    />
  );
  const properties = right === "properties";
  const details = (
    <Stack p="sm" gap="sm">
      <Input
        size="xs"
        aria-label={properties ? "Branch" : "Activity comment"}
        value={properties ? branch : comment}
        placeholder={properties ? undefined : "Leave a comment…"}
        onChange={(event) => (properties ? setBranch(event.target.value) : setComment(event.target.value))}
      />
      <Text textStyle="label/XS" color="fg.muted">
        {properties ? "Base: main" : "You updated src/index.ts · 2 minutes ago"}
      </Text>
    </Stack>
  );
  return (
    <Stack h="full" maxW={narrow ? "lg" : undefined} mx="auto" w="full" gap="0" bg="bg" minH="0">
      <Header borderBottomWidth="1px" borderColor="border.subtle">
        <Breadcrumb items={[{ title: "Workspaces" }, { title: "WS-310 · Menu header" }]} />
      </Header>
      <Tabs.Root
        value={tab}
        onValueChange={({ value }) => setTab(value)}
        size="sm"
        flex="1"
        minH="0"
        display="flex"
        flexDirection="column"
      >
        <Header
          variant="narrow"
          aria-label="Workspace menu header"
          borderBottomWidth="1px"
          borderColor="border.subtle"
          flexShrink="0"
        >
          <Tabs.List aria-label="Workspace views">
            <Tabs.Trigger value="files">
              <WorkbenchIcon name="Files" />
              Files
            </Tabs.Trigger>
            <Tabs.Trigger value="changes">
              <WorkbenchIcon name="FileDiff" />
              Changes
            </Tabs.Trigger>
          </Tabs.List>
          <Box flex="1" />
          <Input
            size="xs"
            w={narrow ? "24" : "40"}
            minW="16"
            placeholder="Search files…"
            aria-label="Search files"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
          <HStack gap="2xs">
            {(["files", "properties", "activity"] as const).map((kind) => {
              const label = { files: "Files", properties: "Properties", activity: "Activity" }[kind];
              const open = kind === "files" ? filesOpen : right === kind;
              return (
                <Tooltip key={kind} content={label}>
                  <IconButton
                    size="2xs"
                    variant="ghost"
                    aria-label={label}
                    aria-expanded={open}
                    onClick={() => (kind === "files" ? setFilesOpen(!filesOpen) : setRight(open ? undefined : kind))}
                  >
                    <WorkbenchIcon
                      name={{ files: "Files", properties: "SlidersHorizontal", activity: "TextPen" }[kind]}
                    />
                  </IconButton>
                </Tooltip>
              );
            })}
          </HStack>
        </Header>
        <Flex ref={bounds} flex="1" minH="0" minW="0" position="relative">
          {!narrow && filesOpen ? (
            <Box w="2xs" flexShrink="0" borderRightWidth="1px" borderColor="border.subtle" overflow="auto">
              {tree}
            </Box>
          ) : null}
          <Box flex="1" minW="0" minH="0" overflow="hidden">
            <Tabs.Content value="files" h="full" p="0">
              <Stack h="full" gap="0" minH="0">
                <Text textStyle="label/XS" color="fg.muted" px="md" py="xs">
                  {selected}
                </Text>
                <Box flex="1" minH="0">
                  <Textarea
                    aria-label="File draft"
                    value={draft}
                    onChange={(event) => setDrafts({ ...drafts, [selected]: event.target.value })}
                    h="full"
                    resize="none"
                    borderWidth="0"
                    borderRadius="0"
                    fontFamily="mono"
                    textStyle="label/S"
                    p="md"
                  />
                </Box>
              </Stack>
            </Tabs.Content>
            <Tabs.Content value="changes" h="full" p="0">
              <Stack p="md" gap="sm">
                <Text as="pre" fontFamily="mono" textStyle="label/S" color="fg.error">
                  - export const ready = false;
                </Text>
                <Text as="pre" fontFamily="mono" textStyle="label/S" color="fg.success" whiteSpace="pre-wrap">
                  + {drafts["src/index.ts"] ?? initialCode}
                </Text>
              </Stack>
            </Tabs.Content>
          </Box>
          {!narrow && right ? (
            <Box w="2xs" flexShrink="0" borderLeftWidth="1px" borderColor="border.subtle" overflow="auto">
              {details}
            </Box>
          ) : null}
          {narrow
            ? (["left", "right"] as const).map((side) => (
                <Popover.Root
                  key={side}
                  open={side === "left" ? filesOpen : Boolean(right)}
                  onOpenChange={({ open }) => (side === "left" ? setFilesOpen(open) : !open && setRight(undefined))}
                  closeOnInteractOutside={false}
                  positioning={{
                    placement: side === "left" ? "bottom-start" : "bottom-end",
                    getAnchorRect: () => {
                      const rect = bounds.current?.getBoundingClientRect();
                      return rect ? { x: rect.x, y: rect.y, width: rect.width, height: 0 } : null;
                    },
                    offset: { mainAxis: 0 },
                    flip: false,
                    slide: false,
                    overflowPadding: 0,
                  }}
                >
                  <Portal>
                    <Popover.Positioner>
                      <Popover.Content
                        aria-label={side === "left" ? "Files menu" : `${right} menu`}
                        w="2xs"
                        p="0"
                        maxH="var(--available-height)"
                        overflow="auto"
                      >
                        {side === "left" ? tree : details}
                      </Popover.Content>
                    </Popover.Positioner>
                  </Portal>
                </Popover.Root>
              ))
            : null}
        </Flex>
      </Tabs.Root>
    </Stack>
  );
};
