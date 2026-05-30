import { Box, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { useState } from "react";

import { ColumnFileBrowser, type ColumnFileItem } from "./column-file-browser";

type StoryFn = () => ReactNode;

const demoItems: ColumnFileItem[] = [
  {
    id: "sample-raw",
    name: "sample-raw",
    type: "folder",
    meta: "3 items",
    children: [
      {
        id: "sample-raw/invoices",
        name: "invoices",
        type: "folder",
        meta: "2 items",
        children: [
          {
            id: "sample-raw/invoices/2024-02.pdf",
            name: "2024-02.pdf",
            type: "file",
            meta: "1.2 MB · Feb 2, 2024",
          },
          {
            id: "sample-raw/invoices/2024-03.pdf",
            name: "2024-03.pdf",
            type: "file",
            meta: "980 KB · Mar 8, 2024",
          },
        ],
      },
      {
        id: "sample-raw/contracts",
        name: "contracts",
        type: "folder",
        meta: "1 item",
        children: [
          {
            id: "sample-raw/contracts/vendor-agreement.pdf",
            name: "vendor-agreement.pdf",
            type: "file",
            meta: "2.1 MB · Jan 18, 2024",
          },
        ],
      },
      {
        id: "sample-raw/notes.md",
        name: "notes.md",
        type: "file",
        meta: "6 KB · Apr 8, 2024",
      },
    ],
  },
  {
    id: "sample-artifacts",
    name: "sample-artifacts",
    type: "folder",
    meta: "2 items",
    children: [
      {
        id: "sample-artifacts/run-042",
        name: "run-042",
        type: "folder",
        meta: "1 item",
        children: [
          {
            id: "sample-artifacts/run-042/output.json",
            name: "output.json",
            type: "file",
            meta: "48 KB · May 8, 2024",
          },
        ],
      },
      {
        id: "sample-artifacts/logs",
        name: "logs",
        type: "folder",
        meta: "0 items",
        children: [],
      },
    ],
  },
  {
    id: "sample-validation/summary.csv",
    name: "summary.csv",
    type: "file",
    meta: "18 KB · Jul 20, 2024",
  },
];

const emptyItems: ColumnFileItem[] = [
  {
    id: "sample-raw",
    name: "sample-raw",
    type: "folder",
    meta: "0 items",
    children: [],
  },
];

const formatPath = (path: ColumnFileItem[]) => {
  if (path.length === 0) return "root";

  return path.map((item) => item.name).join(" / ");
};

const formatFileCount = (count: number) => `${count} file${count === 1 ? "" : "s"}`;

const canDeleteItem = (item: ColumnFileItem) => item.type === "file";

const meta = {
  title: "Components/Navigation/Column File Browser",
  component: ColumnFileBrowser,
  decorators: [
    (Story: StoryFn) => (
      <Box padding="sm" background="bg">
        <Story />
      </Box>
    ),
  ],
};

export default meta;

export const Default = {
  render: () => {
    const [activity, setActivity] = useState("Select a file or folder.");

    const handleFolderOpen = (_folder: ColumnFileItem, path: ColumnFileItem[]) => {
      setActivity(`Opened folder: ${formatPath(path)}`);
    };

    const handleFileOpen = (_file: ColumnFileItem, path: ColumnFileItem[]) => {
      setActivity(`Opened file: ${formatPath(path)}`);
    };

    const handleDeleteItem = (item: ColumnFileItem, path: ColumnFileItem[]) => {
      setActivity(`Deleted ${item.type}: ${formatPath(path)}`);
    };

    const handleDownloadFile = (_file: ColumnFileItem, path: ColumnFileItem[]) => {
      setActivity(`Downloaded: ${formatPath(path)}`);
    };

    const handleDropFiles = (files: File[], _folder: ColumnFileItem | null, path: ColumnFileItem[]) => {
      const fileLabel = formatFileCount(files.length);

      setActivity(`Dropped ${fileLabel} into ${formatPath(path)}`);
    };

    const handleUploadClick = () => {
      setActivity("Upload clicked.");
    };

    return (
      <Stack gap="sm">
        <Box borderWidth="1px" borderColor="border.muted" borderRadius="md" overflow="hidden" height="420px">
          <ColumnFileBrowser
            items={demoItems}
            emptyLabel="This folder is empty."
            onFolderOpen={handleFolderOpen}
            onFileOpen={handleFileOpen}
            onDeleteItem={handleDeleteItem}
            onDownloadFile={handleDownloadFile}
            onDropFiles={handleDropFiles}
            onUploadClick={handleUploadClick}
            canDeleteItem={canDeleteItem}
          />
        </Box>
        <Text textStyle="paragraph/XS/regular" color="fg.muted">
          {activity}
        </Text>
      </Stack>
    );
  },
};

export const EmptyFolder = {
  render: () => {
    const [activity, setActivity] = useState("Drop files here to upload.");

    const handleFolderOpen = (_folder: ColumnFileItem, path: ColumnFileItem[]) => {
      setActivity(`Opened folder: ${formatPath(path)}`);
    };

    const handleDropFiles = (files: File[], _folder: ColumnFileItem | null, path: ColumnFileItem[]) => {
      const fileLabel = formatFileCount(files.length);

      setActivity(`Dropped ${fileLabel} into ${formatPath(path)}`);
    };

    const handleUploadClick = () => {
      setActivity("Upload clicked.");
    };

    return (
      <Stack gap="sm">
        <Box borderWidth="1px" borderColor="border.muted" borderRadius="md" overflow="hidden" height="280px">
          <ColumnFileBrowser
            items={emptyItems}
            emptyLabel="Nothing here yet."
            onFolderOpen={handleFolderOpen}
            onDropFiles={handleDropFiles}
            onUploadClick={handleUploadClick}
          />
        </Box>
        <Text textStyle="paragraph/XS/regular" color="fg.muted">
          {activity}
        </Text>
      </Stack>
    );
  },
};
