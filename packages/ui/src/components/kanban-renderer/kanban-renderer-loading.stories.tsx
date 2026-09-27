import { Button, Skeleton, Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { KanbanRenderer } from "./kanban-renderer";
import { attributes, initialRows } from "./kanban-renderer-story-fixtures";

const QueryLoading = () => {
  const [loading, setLoading] = useState(false);
  return (
    <Stack h="full">
      <Button onClick={() => setLoading(!loading)}>Toggle query loading</Button>
      <KanbanRenderer
        storageKey="storybook-query-loading"
        attributes={attributes}
        rows={loading ? [] : initialRows}
        contentPlaceholder={loading ? <Skeleton minH="12rem" /> : undefined}
      />
    </Stack>
  );
};

export default {
  title: "Patterns/Kanban Renderer/Query Loading",
  component: QueryLoading,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof QueryLoading>;

export const StableControls: StoryObj<typeof QueryLoading> = {};
