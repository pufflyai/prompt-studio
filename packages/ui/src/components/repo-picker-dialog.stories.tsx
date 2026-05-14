import { Badge, Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { useState } from "react";

import { RepoPickerDialog, type RepoPickerDialogEntry } from "./repo-picker-dialog";

type StoryFn = () => ReactNode;

const rootPath = "~";

const resolveParentPath = (value: string) => {
  const trimmed = value.replace(/\\/g, "/").replace(/\/+$/g, "");

  if (!trimmed) {
    return "/";
  }

  const parts = trimmed.split("/").filter(Boolean);

  if (parts.length <= 1) {
    return "/";
  }

  return `/${parts.slice(0, -1).join("/")}`;
};

const directoryMap: Record<string, RepoPickerDialogEntry[]> = {
  "~": [
    { name: "Code", path: "/Users/you/Code", isDirectory: true, isGitRepo: false },
    { name: "Desktop", path: "/Users/you/Desktop", isDirectory: true, isGitRepo: false },
    { name: "Documents", path: "/Users/you/Documents", isDirectory: true, isGitRepo: false },
    { name: "Downloads", path: "/Users/you/Downloads", isDirectory: true, isGitRepo: false },
    { name: "infra", path: "/Users/you/infra", isDirectory: true, isGitRepo: true },
    { name: "prompt-studio", path: "/Users/you/prompt-studio", isDirectory: true, isGitRepo: true },
    { name: "release-notes.md", path: "/Users/you/release-notes.md", isDirectory: false, isGitRepo: false },
  ],
  "/Users/you/Code": [
    { name: "api-server", path: "/Users/you/Code/api-server", isDirectory: true, isGitRepo: true },
    { name: "client-web", path: "/Users/you/Code/client-web", isDirectory: true, isGitRepo: true },
    { name: "docs-site", path: "/Users/you/Code/docs-site", isDirectory: true, isGitRepo: true },
    { name: "legacy", path: "/Users/you/Code/legacy", isDirectory: true, isGitRepo: false },
    { name: "playground", path: "/Users/you/Code/playground", isDirectory: true, isGitRepo: false },
    { name: "tools", path: "/Users/you/Code/tools", isDirectory: true, isGitRepo: false },
    { name: "todo.txt", path: "/Users/you/Code/todo.txt", isDirectory: false, isGitRepo: false },
    { name: "ux-kits", path: "/Users/you/Code/ux-kits", isDirectory: true, isGitRepo: true },
  ],
  "/Users/you/Code/legacy": [
    { name: "archive", path: "/Users/you/Code/legacy/archive", isDirectory: true, isGitRepo: false },
    { name: "old-admin", path: "/Users/you/Code/legacy/old-admin", isDirectory: true, isGitRepo: true },
    { name: "old-mobile", path: "/Users/you/Code/legacy/old-mobile", isDirectory: true, isGitRepo: true },
  ],
  "/Users/you/Code/playground": [
    { name: "auth-prototype", path: "/Users/you/Code/playground/auth-prototype", isDirectory: true, isGitRepo: true },
    { name: "design-spikes", path: "/Users/you/Code/playground/design-spikes", isDirectory: true, isGitRepo: false },
    { name: "notes.md", path: "/Users/you/Code/playground/notes.md", isDirectory: false, isGitRepo: false },
  ],
  "/Users/you/Code/tools": [
    { name: "cli-utils", path: "/Users/you/Code/tools/cli-utils", isDirectory: true, isGitRepo: true },
    { name: "scripts", path: "/Users/you/Code/tools/scripts", isDirectory: true, isGitRepo: false },
    { name: "templates", path: "/Users/you/Code/tools/templates", isDirectory: true, isGitRepo: false },
  ],
  "/Users/you/Code/tools/scripts": [
    { name: "cleanup", path: "/Users/you/Code/tools/scripts/cleanup", isDirectory: true, isGitRepo: false },
    { name: "deploy", path: "/Users/you/Code/tools/scripts/deploy", isDirectory: true, isGitRepo: false },
  ],
  "/Users/you/Documents": [
    { name: "contracts", path: "/Users/you/Documents/contracts", isDirectory: true, isGitRepo: false },
    { name: "designs", path: "/Users/you/Documents/designs", isDirectory: true, isGitRepo: false },
    { name: "scripts", path: "/Users/you/Documents/scripts", isDirectory: true, isGitRepo: true },
    { name: "research", path: "/Users/you/Documents/research", isDirectory: true, isGitRepo: false },
  ],
  "/Users/you/Documents/research": [
    { name: "experiments", path: "/Users/you/Documents/research/experiments", isDirectory: true, isGitRepo: true },
    { name: "papers", path: "/Users/you/Documents/research/papers", isDirectory: true, isGitRepo: false },
  ],
  "/Users/you/Downloads": [],
  "/Users/you/Desktop": [
    { name: "screenshots", path: "/Users/you/Desktop/screenshots", isDirectory: true, isGitRepo: false },
    { name: "tmp", path: "/Users/you/Desktop/tmp", isDirectory: true, isGitRepo: false },
  ],
  "/Users/you/infra": [
    { name: ".git", path: "/Users/you/infra/.git", isDirectory: true, isGitRepo: false },
    { name: "environments", path: "/Users/you/infra/environments", isDirectory: true, isGitRepo: false },
    { name: "terraform", path: "/Users/you/infra/terraform", isDirectory: true, isGitRepo: false },
  ],
  "/Users/you/prompt-studio": [
    { name: ".git", path: "/Users/you/prompt-studio/.git", isDirectory: true, isGitRepo: false },
    { name: "clients", path: "/Users/you/prompt-studio/clients", isDirectory: true, isGitRepo: false },
    { name: "packages", path: "/Users/you/prompt-studio/packages", isDirectory: true, isGitRepo: false },
  ],
  "/Users/you/Code/api-server": [
    { name: ".git", path: "/Users/you/Code/api-server/.git", isDirectory: true, isGitRepo: false },
    { name: "src", path: "/Users/you/Code/api-server/src", isDirectory: true, isGitRepo: false },
  ],
  "/Users/you/Code/client-web": [
    { name: ".git", path: "/Users/you/Code/client-web/.git", isDirectory: true, isGitRepo: false },
    { name: "src", path: "/Users/you/Code/client-web/src", isDirectory: true, isGitRepo: false },
  ],
  "/Users/you/Code/docs-site": [
    { name: ".git", path: "/Users/you/Code/docs-site/.git", isDirectory: true, isGitRepo: false },
    { name: "content", path: "/Users/you/Code/docs-site/content", isDirectory: true, isGitRepo: false },
  ],
  "/Users/you/Code/ux-kits": [
    { name: ".git", path: "/Users/you/Code/ux-kits/.git", isDirectory: true, isGitRepo: false },
    { name: "assets", path: "/Users/you/Code/ux-kits/assets", isDirectory: true, isGitRepo: false },
  ],
  "/Users/you/Documents/scripts": [
    { name: ".git", path: "/Users/you/Documents/scripts/.git", isDirectory: true, isGitRepo: false },
    { name: "ops", path: "/Users/you/Documents/scripts/ops", isDirectory: true, isGitRepo: false },
  ],
  "/Users/you/Documents/research/experiments": [
    { name: ".git", path: "/Users/you/Documents/research/experiments/.git", isDirectory: true, isGitRepo: false },
    { name: "v1", path: "/Users/you/Documents/research/experiments/v1", isDirectory: true, isGitRepo: false },
  ],
  "/Users/you/Code/tools/cli-utils": [
    { name: ".git", path: "/Users/you/Code/tools/cli-utils/.git", isDirectory: true, isGitRepo: false },
    { name: "src", path: "/Users/you/Code/tools/cli-utils/src", isDirectory: true, isGitRepo: false },
  ],
  "/Users/you/Code/legacy/old-admin": [
    { name: ".git", path: "/Users/you/Code/legacy/old-admin/.git", isDirectory: true, isGitRepo: false },
  ],
  "/Users/you/Code/legacy/old-mobile": [
    { name: ".git", path: "/Users/you/Code/legacy/old-mobile/.git", isDirectory: true, isGitRepo: false },
  ],
  "/Users/you/Code/playground/auth-prototype": [
    { name: ".git", path: "/Users/you/Code/playground/auth-prototype/.git", isDirectory: true, isGitRepo: false },
  ],
};

const sortEntries = (entries: RepoPickerDialogEntry[]) =>
  [...entries].sort((left, right) => {
    const byName = left.name.localeCompare(right.name, undefined, { sensitivity: "base" });

    if (byName !== 0) {
      return byName;
    }

    return left.path.localeCompare(right.path, undefined, { sensitivity: "base" });
  });

const isGitRepoPath = (path: string) =>
  (directoryMap[path] ?? []).some((entry) => entry.name === ".git" && entry.isDirectory);

const meta = {
  title: "Components/RepoPickerDialog",
  component: RepoPickerDialog,
  decorators: [
    (Story: StoryFn) => (
      <Box minH="520px" padding="sm" background="bg">
        <Story />
      </Box>
    ),
  ],
};

export default meta;

export const Default = {
  render: () => {
    const [open, setOpen] = useState(false);
    const [currentPath, setCurrentPath] = useState(rootPath);
    const [selectedPath, setSelectedPath] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [confirmedPath, setConfirmedPath] = useState<string | null>(null);

    const entries = sortEntries(directoryMap[currentPath] ?? []);

    const handleOpen = () => {
      setOpen(true);
      setCurrentPath(rootPath);
      setSelectedPath(null);
      setError("");
    };

    const handleEntryClick = (entry: RepoPickerDialogEntry) => {
      setError("");

      if (!entry.isDirectory) {
        return;
      }

      if (entry.isGitRepo) {
        setSelectedPath((value) => (value === entry.path ? null : entry.path));
        return;
      }

      setSelectedPath(null);
      setCurrentPath(entry.path);
    };

    const handleSelect = () => {
      const targetPath = selectedPath ?? currentPath;
      const canSelectCurrentPath = isGitRepoPath(currentPath);
      const canSelect = selectedPath ? true : canSelectCurrentPath;

      if (!targetPath || !canSelect) {
        setError("Selected folder is not a git repository.");
        return;
      }

      setConfirmedPath(targetPath);
      setError("");
      setOpen(false);
    };

    return (
      <Stack gap="md" maxWidth="760px">
        <HStack gap="sm" align="center">
          <Button size="sm" variant="solid" onClick={handleOpen}>
            Start folder picker
          </Button>
          <Badge colorPalette={confirmedPath ? "green" : "gray"} variant="subtle">
            {confirmedPath ? "Repository selected" : "No repository selected"}
          </Badge>
        </HStack>
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          Selected path: {confirmedPath ?? "None"}
        </Text>
        <RepoPickerDialog
          open={open}
          title="Select repository folder"
          description="Browse a larger project tree and pick one repository."
          currentPath={currentPath}
          entries={entries}
          selectedPath={selectedPath}
          selectedPaths={["/Users/you/prompt-studio", "/Users/you/Code/client-web"]}
          error={error}
          onClose={() => setOpen(false)}
          onSelect={handleSelect}
          onSelectHomeDirectory={() => {
            setError("");
            setSelectedPath(null);
            setCurrentPath(rootPath);
          }}
          onSelectParentDirectory={() => {
            setError("");
            setSelectedPath(null);
            setCurrentPath(resolveParentPath(currentPath));
          }}
          onEntryClick={handleEntryClick}
        />
      </Stack>
    );
  },
};
