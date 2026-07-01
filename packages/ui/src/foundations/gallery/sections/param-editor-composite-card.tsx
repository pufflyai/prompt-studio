import { Button, HStack } from "@chakra-ui/react";
import { ParamEditor } from "@/components/param-editor";
import { GalleryCard } from "../gallery-frame";

export const ParamEditorCompositeCard = () => {
  return (
    <GalleryCard title="Parameter editor" names={["ParamEditor"]} gridColumn={{ base: "auto", xl: "span 2" }}>
      <ParamEditor
        fullWidth
        defaultValues={{
          model: "balanced",
          channels: ["chat", "summary"],
          temperature: 0.4,
          instructions: "Summarize the selected workspace changes.",
          releaseDate: "2026-07-01",
          accent: "#0C8CE9",
        }}
        groups={[
          {
            id: "generation",
            title: "Generation",
            description: "Core model, channel, and sampling controls.",
            collapsible: true,
            params: [
              {
                id: "model",
                name: "Model",
                type: "selection",
                description: "Generation profile",
                defaultValue: "balanced",
                options: [
                  { id: "fast", name: "Fast" },
                  { id: "balanced", name: "Balanced" },
                  { id: "deep", name: "Deep" },
                ],
              },
              {
                id: "channels",
                name: "Channels",
                type: "selection",
                description: "Output destinations",
                defaultValue: ["chat", "summary"],
                multiSelect: true,
                options: [
                  { id: "chat", name: "Chat" },
                  { id: "summary", name: "Summary" },
                  { id: "artifact", name: "Artifact" },
                  { id: "timeline", name: "Timeline" },
                ],
              },
              {
                id: "temperature",
                name: "Temperature",
                type: "number",
                description: "Sampling variance",
                defaultValue: 0.4,
                min: 0,
                max: 1,
                step: 0.1,
              },
            ],
          },
          {
            id: "content",
            title: "Content",
            description: "Prompt text and presentation metadata.",
            collapsible: true,
            params: [
              {
                id: "instructions",
                name: "Instructions",
                type: "text",
                description: "Prompt template",
                defaultValue: "Summarize the selected workspace changes.",
                singleLine: false,
              },
              {
                id: "releaseDate",
                name: "Release Date",
                type: "date",
                description: "Target handoff date",
                defaultValue: "2026-07-01",
              },
              {
                id: "accent",
                name: "Accent",
                type: "color",
                description: "Primary output color",
                defaultValue: "#0C8CE9",
              },
              {
                id: "state",
                name: "State",
                type: "property",
                description: "Current review status",
                value: (
                  <HStack gap="xs">
                    <Button size="xs" variant="outline">
                      Review
                    </Button>
                    <Button size="xs" variant="ghost">
                      Change
                    </Button>
                  </HStack>
                ),
              },
            ],
          },
          {
            id: "advanced",
            title: "Advanced",
            description: "Collapsed by default to show dense section behavior.",
            collapsible: true,
            defaultCollapsed: true,
            params: [
              {
                id: "seed",
                name: "Seed",
                type: "text",
                description: "Optional deterministic seed",
                defaultValue: "release-07",
                singleLine: true,
              },
            ],
          },
        ]}
        onChange={() => undefined}
      />
    </GalleryCard>
  );
};
