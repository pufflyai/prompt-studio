import { HStack } from "@chakra-ui/react";
import { useState } from "react";
import { ChatInput } from "../chat-ui/components/chat-input";
import { createSerializedPromptState } from "../chat-ui/utils/editor-state";
import { HarnessModelMenu } from "./harness-model-menu";
import { HarnessParamInlineControls } from "./harness-param-inline-controls";
import type { HarnessParamValues } from "./harness-param-values";

export default {
  title: "Design system/Patterns/Chat/Composer controls",
  description: "Existing compact harness/model and inline settings toolbar, shared by native chat hosts.",
};

export const CompactComposer = () => {
  const [model, setModel] = useState("sonnet");
  const [overrides, setOverrides] = useState<HarnessParamValues>({});
  return (
    <ChatInput
      defaultState={createSerializedPromptState("Keep this draft")}
      actions={
        <HStack gap="2xs" minW="0">
          <HarnessModelMenu
            agentOptions={[{ value: "claude", label: "Claude Code" }]}
            selectedAgent="claude"
            onSelectAgent={() => {}}
            modelOptions={[
              { value: "sonnet", label: "Sonnet" },
              { value: "opus", label: "Opus" },
            ]}
            selectedModel={model}
            onSelectModel={setModel}
            size="xs"
          />
          <HarnessParamInlineControls
            schema={{
              effort: {
                type: "select",
                label: "Reasoning effort",
                defaultValue: "medium",
                options: [
                  { value: "medium", label: "Medium", icon: "level-mid" },
                  { value: "high", label: "High", icon: "level-high" },
                ],
              },
            }}
            defaults={{ effort: "medium" }}
            overrides={overrides}
            onOverridesChange={setOverrides}
            size="xs"
          />
        </HStack>
      }
    />
  );
};
