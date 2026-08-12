import { Box } from "@chakra-ui/react";
import type { ResourceRef } from "@pstdio/workbench";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { BrowserPreviewPanel } from "./browser-preview-panel";
import { createBrowserPreviewResource } from "./browser-preview-resource";
import type { BrowserPreviewUrlResult } from "./browser-preview-url";
import type { BrowserPreviewViewport } from "./browser-preview-viewport";

interface BrowserPreviewStoryProps {
  addressDraft?: string;
  helpOpen?: boolean;
  resource: ResourceRef;
  validation?: BrowserPreviewUrlResult;
}

const BrowserPreviewStory = (props: BrowserPreviewStoryProps) => {
  const { addressDraft, helpOpen, validation } = props;
  const [resource, setResource] = useState(props.resource);
  const instance = {
    instanceId: "browser-preview-story",
    panelId: "dashboard-workbench.browser-preview",
    resource,
    resourceUri: resource.uri,
    title: resource.label,
    closable: true,
    mountStrategy: "keep-mounted" as const,
  };
  const input = {
    instance,
    panel: {
      id: "dashboard-workbench.browser-preview",
      title: "Browser",
      region: "main",
      rendererId: "dashboard-workbench.browser-preview",
      closable: true,
    },
    refresh: () => undefined,
    workbench: {
      layout: {
        updatePanel: (_instanceId: string, update: { resource?: ResourceRef }) => {
          if (update.resource) setResource(update.resource);
          return { ...instance, ...update };
        },
      },
    },
  } as unknown as WorkbenchPanelRenderInput;

  return (
    <Box h="46rem" maxW="76rem" borderWidth="1px" borderColor="border.muted">
      <BrowserPreviewPanel
        input={input}
        initialAddressDraft={addressDraft}
        initialHelpOpen={helpOpen}
        initialValidation={validation}
        urlPolicy={{ dashboardOrigin: "http://localhost:5173", apiOrigin: "http://localhost:3000" }}
      />
    </Box>
  );
};

const previewResource = (input: { url?: string; viewport?: BrowserPreviewViewport }) =>
  createBrowserPreviewResource({
    projectId: "project-a",
    previewId: "story",
    url: input.url,
    viewport: input.viewport,
  });

const meta: Meta<typeof BrowserPreviewStory> = {
  title: "BrowserPreview/Panel",
  component: BrowserPreviewStory,
  parameters: { layout: "padded" },
};

export default meta;

type Story = StoryObj<typeof BrowserPreviewStory>;

export const Empty: Story = {
  args: {
    resource: previewResource({}),
  },
};

export const InvalidAddress: Story = {
  args: {
    addressDraft: "file:///tmp/index.html",
    resource: previewResource({ url: "http://localhost:5174/" }),
    validation: {
      ok: false,
      reason: "unsupported-scheme",
      message: "Browser Preview supports only HTTP(S) URLs.",
    },
  },
};

export const LoadedDesktop: Story = {
  args: {
    resource: previewResource({
      url: "http://localhost:5174/",
      viewport: { mode: "desktop" },
    }),
  },
};

export const CustomViewport: Story = {
  args: {
    resource: previewResource({
      url: "http://localhost:5174/settings",
      viewport: { mode: "custom", width: 1024, height: 720 },
    }),
  },
};

export const FramingHelp: Story = {
  args: {
    helpOpen: true,
    resource: previewResource({ url: "https://example.test/" }),
  },
};
