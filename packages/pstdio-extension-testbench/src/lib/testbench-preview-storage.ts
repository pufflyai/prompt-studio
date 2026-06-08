import type { BenchStorageSeed } from "./testbench-environment";

// 1x1 transparent PNG, so the image-attachment preview has real bytes to render.
const previewImageBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

export const createPreviewStorage = (): BenchStorageSeed => {
  const now = new Date(0).toISOString();

  return {
    blobs: {
      "preview-image": { name: "diagram.png", mimeType: "image/png", base64: previewImageBase64 },
    },
    // Linked to PS-16 so ticket mode renders a Workspaces section in the sidebar.
    workspaces: [
      {
        id: "ws-preview-1",
        workspace_shorthand: "WS-1",
        ticket_shorthand: "PS-16",
        branch: "feature/tree-renderer",
        attempt_status_name: "In progress",
        worktree_path: "/tmp/ws-preview-1",
      },
      {
        id: "ws-preview-2",
        workspace_shorthand: "WS-2",
        ticket_shorthand: "PS-16",
        branch: "feature/tree-renderer-followup",
      },
    ],
    collections: {
      tickets: {
        "PS-15": {
          id: "PS-15",
          shorthand: "PS-15",
          title: "Parent ticket preview",
          content: "# Parent ticket preview\n\nLinked from PS-16 to exercise the properties panel links.",
          statusId: null,
          archived: false,
          sortOrder: 0,
          createdAt: now,
          updatedAt: now,
        },
        "PS-16": {
          id: "PS-16",
          shorthand: "PS-16",
          title: "Tree renderer preview",
          content: "# Tree renderer preview\n\nUse this ticket resource to inspect extension tree contributions.",
          statusId: null,
          parentId: "PS-15",
          dependsOn: "PS-15",
          archived: false,
          sortOrder: 1,
          files: [
            {
              id: "requirements",
              name: "requirements.md",
              content: "Preview the tree renderer outside the dashboard.",
              createdAt: now,
              updatedAt: now,
            },
            {
              id: "notes",
              name: "notes.md",
              content: "Click tree rows to exercise contributed command targets.",
              createdAt: now,
              updatedAt: now,
            },
          ],
          attachments: [
            {
              id: "preview-image",
              name: "diagram.png",
              mimeType: "image/png",
              size: 70,
              hash: "",
              url: "bench://files/preview-image",
              createdAt: now,
              updatedAt: now,
            },
          ],
          createdAt: now,
          updatedAt: now,
        },
      },
    },
  };
};
