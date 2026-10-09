import { Button, Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { CommandParamsDialog } from "./command-params-dialog";

const ResourceOptionsExample = () => {
  const [resource, setResource] = useState<string | undefined>();
  return (
    <WorkbenchThemeProvider>
      <Stack align="start">
        {["first", "second"].map((id) => (
          <Button key={id} size="sm" onClick={() => setResource(id)}>
            Open {id} instance
          </Button>
        ))}
        <CommandParamsDialog
          request={
            resource
              ? {
                  label: "Choose template",
                  context: { resource: { type: "instance", id: resource, metadata: { instance: resource } } },
                  record: {
                    command: {
                      id: "run",
                      label: "Choose template",
                      params: {
                        instance: { type: "text", resolvedFrom: "resource", required: true },
                        template: {
                          type: "select",
                          required: true,
                          options: {
                            commandId: "templates",
                            valueField: "id",
                            labelField: "name",
                            params: { instance: { kind: "param-value", key: "instance" } },
                          },
                        },
                      },
                    },
                  },
                }
              : null
          }
          executeOptionCommand={async (_id, args) => [
            { id: `${args.instance}-template`, name: `Template for ${args.instance}` },
          ]}
          onClose={() => setResource(undefined)}
          onRun={async () => setResource(undefined)}
        />
      </Stack>
    </WorkbenchThemeProvider>
  );
};

const meta = {
  title: "pstdio-workbench/Guides/Command resource options",
  component: ResourceOptionsExample,
} satisfies Meta<typeof ResourceOptionsExample>;
export default meta;
export const HiddenResourceDependency: StoryObj<typeof meta> = {};
