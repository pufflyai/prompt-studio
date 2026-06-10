import { Button, Container, HStack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { ParamEditor } from "./param-editor";

const meta = {
  title: "Components/Inputs/Param Editor",
  component: ParamEditor,
  parameters: {
    layout: "fullscreen",
  },
  tags: [],
  argTypes: {},
} satisfies Meta<typeof ParamEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Demo: Story = {
  render: (props) => {
    return (
      <Container padding="md">
        <ParamEditor {...props} />
      </Container>
    );
  },
  args: {
    defaultValues: {
      "1": 5,
      "2": 5,
      "3": "Hello World",
      "4": "This is a multiline text example\nwith multiple lines",
      "5": "user",
      "6": "2024-07-30",
      "7": "#ff0000",
    },
    onChange: () => {},
    params: [
      {
        id: "1",
        name: "Temperature",
        type: "number",
        description: "Controls randomness in the output",
        defaultValue: 1,
        min: 0,
        max: 2,
        step: 0.1,
      },
      {
        id: "2",
        name: "Max Tokens",
        type: "number",
        description: "Maximum number of tokens to generate",
        defaultValue: 100,
        min: 1,
        max: 1000,
        step: 1,
      },
      {
        id: "3",
        name: "System Message",
        type: "text",
        description: "Single line system instruction",
        defaultValue: "You are a helpful assistant",
        singleLine: true,
      },
      {
        id: "4",
        name: "Prompt Template",
        type: "text",
        description: "Multi-line prompt template",
        defaultValue: "Please help me with:\n{user_input}",
        singleLine: false,
      },
      {
        id: "5",
        name: "Role",
        type: "selection",
        description: "Select a role",
        defaultValue: "user",
        options: [
          { id: "user", name: "User" },
          { id: "assistant", name: "Assistant" },
          { id: "system", name: "System" },
        ],
      },
      {
        id: "6",
        name: "Start Date",
        type: "date",
        description: "Select the start date for the process",
        defaultValue: "2024-01-01",
        min: "2024-01-01",
        max: "2024-12-31",
      },
      {
        id: "7",
        name: "Theme Color",
        type: "color",
        description: "Pick a theme color",
        defaultValue: "#ff0000",
      },
    ],
    readOnly: false,
  },
};

export const PropertyRows: Story = {
  render: (props) => {
    return (
      <Container padding="md">
        <ParamEditor {...props} />
      </Container>
    );
  },
  args: {
    params: [
      {
        id: "project-name",
        name: "Project Name",
        type: "property",
        description: "The unique identifier for this project",
        value: <Text>My Cool Project</Text>,
      },
      {
        id: "visibility",
        name: "Visibility",
        type: "property",
        description: "Who can see this project",
        value: (
          <HStack gap="sm">
            <Button size="sm" variant="outline">
              Public
            </Button>
            <Button size="sm" variant="ghost">
              Change
            </Button>
          </HStack>
        ),
      },
      {
        id: "version",
        name: "Version",
        type: "property",
        value: <Text>1.0.0</Text>,
      },
    ],
  },
};

export const TextInputFocus: Story = {
  render: (props) => {
    return (
      <Container padding="md">
        <ParamEditor {...props} />
      </Container>
    );
  },
  args: {
    defaultValues: {
      "1": "Short instruction",
      "2": "This is a longer text input\nthat spans multiple lines\nand demonstrates multiline capability",
      "3": "API_KEY_12345",
    },
    onChange: () => {},
    params: [
      {
        id: "1",
        name: "Quick Command",
        type: "text",
        description: "Single line command or instruction",
        defaultValue: "help",
        singleLine: true,
      },
      {
        id: "2",
        name: "Description",
        type: "text",
        description: "Detailed description or documentation",
        defaultValue: "Enter your description here...",
        singleLine: false,
      },
      {
        id: "3",
        name: "API Key",
        type: "text",
        description: "Your API key (read-only in this example)",
        defaultValue: "sk-...",
        singleLine: true,
      },
    ],
    readOnly: false,
  },
};

export const ReadOnly: Story = {
  render: (props) => {
    return (
      <Container padding="md">
        <ParamEditor {...props} />
      </Container>
    );
  },
  args: {
    defaultValues: {
      "1": 0.7,
      "2": "You are a helpful AI assistant",
      "3": "Please analyze the following text:\n{input}\n\nProvide a summary and key insights.",
      "4": "assistant",
      "5": "2024-07-30",
      "6": "#1a73e8",
    },
    onChange: () => {},
    params: [
      {
        id: "1",
        name: "Temperature",
        type: "number",
        description: "Model temperature setting",
        defaultValue: 0.5,
        min: 0,
        max: 1,
        step: 0.1,
      },
      {
        id: "2",
        name: "System Prompt",
        type: "text",
        description: "System-level instructions",
        defaultValue: "You are a helpful assistant",
        singleLine: true,
      },
      {
        id: "3",
        name: "User Prompt Template",
        type: "text",
        description: "Template for user prompts",
        defaultValue: "Please help with: {request}",
        singleLine: false,
      },
      {
        id: "4",
        name: "Role",
        type: "selection",
        description: "Select a role",
        defaultValue: "assistant",
        options: [
          { id: "user", name: "User" },
          { id: "assistant", name: "Assistant" },
          { id: "system", name: "System" },
        ],
      },
      {
        id: "5",
        name: "Deadline",
        type: "date",
        description: "Project deadline (read-only)",
        defaultValue: "2024-12-31",
        min: "2024-01-01",
        max: "2025-12-31",
      },
      {
        id: "6",
        name: "Theme Color",
        type: "color",
        description: "Theme color (read-only)",
        defaultValue: "#1a73e8",
      },
    ],
    readOnly: true,
  },
};

export const DateInputs: Story = {
  render: (props) => {
    return (
      <Container padding="md">
        <ParamEditor {...props} />
      </Container>
    );
  },
  args: {
    defaultValues: {
      "1": "2024-07-30",
      "2": "2024-01-01",
      "3": "2025-12-31",
      "4": "2024-06-15",
    },
    onChange: () => {},
    params: [
      {
        id: "1",
        name: "Current Date",
        type: "date",
        description: "Today's date with no restrictions",
        defaultValue: "2024-07-30",
      },
      {
        id: "2",
        name: "Start Date",
        type: "date",
        description: "Project start date (minimum: 2024-01-01)",
        defaultValue: "2024-01-01",
        min: "2024-01-01",
      },
      {
        id: "3",
        name: "End Date",
        type: "date",
        description: "Project end date (maximum: 2025-12-31)",
        defaultValue: "2025-12-31",
        max: "2025-12-31",
      },
      {
        id: "4",
        name: "Event Date",
        type: "date",
        description: "Event date with both min/max constraints",
        defaultValue: "2024-06-15",
        min: "2024-01-01",
        max: "2024-12-31",
      },
    ],
    readOnly: false,
  },
};

export const MultiSelectExamples: Story = {
  render: (props) => {
    return (
      <Container padding="md">
        <ParamEditor {...props} />
      </Container>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const openMenuButton = canvas.getByRole("button", { name: /User, Assistant/i });

    await expect(openMenuButton).toBeInTheDocument();
    await userEvent.click(openMenuButton);
  },
  args: {
    defaultValues: {
      "1": ["user", "assistant"],
      "2": ["javascript", "typescript", "python"],
      "3": [],
      "4": ["high"],
    },
    onChange: () => {},
    params: [
      {
        id: "1",
        name: "Allowed Roles",
        type: "selection",
        description: "Select multiple roles that are allowed",
        defaultValue: ["user", "assistant"],
        multiSelect: true,
        options: [
          { id: "user", name: "User" },
          { id: "assistant", name: "Assistant" },
          { id: "system", name: "System" },
          { id: "admin", name: "Administrator" },
        ],
      },
      {
        id: "2",
        name: "Programming Languages",
        type: "selection",
        description: "Choose your preferred programming languages",
        defaultValue: ["javascript", "typescript"],
        multiSelect: true,
        options: [
          { id: "javascript", name: "JavaScript" },
          { id: "typescript", name: "TypeScript" },
          { id: "python", name: "Python" },
          { id: "java", name: "Java" },
          { id: "csharp", name: "C#" },
          { id: "go", name: "Go" },
          { id: "rust", name: "Rust" },
        ],
      },
      {
        id: "3",
        name: "Categories",
        type: "selection",
        description: "Select categories (none selected by default)",
        defaultValue: [],
        multiSelect: true,
        placeholder: "Category",
        options: [
          { id: "web", name: "Web Development" },
          { id: "mobile", name: "Mobile Development" },
          { id: "ai", name: "Artificial Intelligence" },
          { id: "data", name: "Data Science" },
          { id: "devops", name: "DevOps" },
        ],
      },
      {
        id: "4",
        name: "Priority Levels",
        type: "selection",
        description: "Select priority levels for tasks",
        defaultValue: ["high"],
        multiSelect: true,
        options: [
          { id: "low", name: "Low Priority" },
          { id: "medium", name: "Medium Priority" },
          { id: "high", name: "High Priority" },
          { id: "urgent", name: "Urgent" },
        ],
      },
    ],
    readOnly: false,
  },
};

export const MixedSelectionTypes: Story = {
  render: (props) => {
    return (
      <Container padding="md">
        <ParamEditor {...props} />
      </Container>
    );
  },
  args: {
    defaultValues: {
      "1": "assistant",
      "2": ["javascript", "python"],
      "3": "production",
      "4": ["feature", "bugfix"],
    },
    onChange: () => {},
    params: [
      {
        id: "1",
        name: "Default Role (Single)",
        type: "selection",
        description: "Choose one default role",
        defaultValue: "assistant",
        options: [
          { id: "user", name: "User" },
          { id: "assistant", name: "Assistant" },
          { id: "system", name: "System" },
        ],
      },
      {
        id: "2",
        name: "Languages (Multi)",
        type: "selection",
        description: "Select multiple programming languages",
        defaultValue: ["javascript"],
        multiSelect: true,
        options: [
          { id: "javascript", name: "JavaScript" },
          { id: "python", name: "Python" },
          { id: "java", name: "Java" },
          { id: "csharp", name: "C#" },
        ],
      },
      {
        id: "3",
        name: "Environment (Single)",
        type: "selection",
        description: "Choose deployment environment",
        defaultValue: "staging",
        options: [
          { id: "development", name: "Development" },
          { id: "staging", name: "Staging" },
          { id: "production", name: "Production" },
        ],
      },
      {
        id: "4",
        name: "Branch Types (Multi)",
        type: "selection",
        description: "Select allowed branch types",
        defaultValue: ["feature"],
        multiSelect: true,
        options: [
          { id: "feature", name: "Feature Branch" },
          { id: "bugfix", name: "Bug Fix" },
          { id: "hotfix", name: "Hot Fix" },
          { id: "release", name: "Release Branch" },
        ],
      },
    ],
    readOnly: false,
  },
};

export const WithInputGroups: Story = {
  render: (props) => {
    return (
      <Container padding="md">
        <ParamEditor {...props} />
      </Container>
    );
  },
  args: {
    defaultValues: {
      temp: 0.7,
      maxTokens: 150,
      systemMsg: "You are a helpful assistant",
      promptTemplate: "Please help me with:\n{user_input}",
      role: "assistant",
      startDate: "2024-01-01",
      endDate: "2024-12-31",
      apiUrl: "https://api.example.com",
      timeout: 30,
    },
    onChange: () => {},
    groups: [
      {
        id: "llm-settings",
        title: "LLM Configuration",
        description: "Settings that control the language model behavior",
        collapsible: true,
        defaultCollapsed: false,
        params: [
          {
            id: "temp",
            name: "Temperature",
            type: "number",
            description: "Controls randomness in the output",
            defaultValue: 0.7,
            min: 0,
            max: 2,
            step: 0.1,
          },
          {
            id: "maxTokens",
            name: "Max Tokens",
            type: "number",
            description: "Maximum number of tokens to generate",
            defaultValue: 150,
            min: 1,
            max: 1000,
            step: 1,
          },
        ],
      },
      {
        id: "prompt-settings",
        title: "Prompt Configuration",
        description: "Configure your prompts and system messages",
        collapsible: true,
        defaultCollapsed: false,
        params: [
          {
            id: "systemMsg",
            name: "System Message",
            type: "text",
            description: "System-level instructions",
            defaultValue: "You are a helpful assistant",
            singleLine: true,
          },
          {
            id: "promptTemplate",
            name: "Prompt Template",
            type: "text",
            description: "Template for user prompts",
            defaultValue: "Please help with: {request}",
            singleLine: false,
          },
          {
            id: "role",
            name: "Default Role",
            type: "selection",
            description: "Select the default role",
            defaultValue: "assistant",
            options: [
              { id: "user", name: "User" },
              { id: "assistant", name: "Assistant" },
              { id: "system", name: "System" },
            ],
          },
        ],
      },
      {
        id: "scheduling",
        title: "Scheduling",
        description: "Date and time configuration",
        collapsible: true,
        defaultCollapsed: true,
        params: [
          {
            id: "startDate",
            name: "Start Date",
            type: "date",
            description: "Project start date",
            defaultValue: "2024-01-01",
            min: "2024-01-01",
          },
          {
            id: "endDate",
            name: "End Date",
            type: "date",
            description: "Project end date",
            defaultValue: "2024-12-31",
            max: "2025-12-31",
          },
        ],
      },
      {
        id: "api-settings",
        title: "API Configuration",
        description: "External API settings and timeouts",
        collapsible: true,
        defaultCollapsed: true,
        params: [
          {
            id: "apiUrl",
            name: "API URL",
            type: "text",
            description: "Base URL for API calls",
            defaultValue: "https://api.example.com",
            singleLine: true,
          },
          {
            id: "timeout",
            name: "Timeout (seconds)",
            type: "number",
            description: "Request timeout in seconds",
            defaultValue: 30,
            min: 5,
            max: 300,
            step: 5,
          },
        ],
      },
    ],
    readOnly: false,
  },
};

export const MixedGroupsAndParams: Story = {
  render: (props) => {
    return (
      <Container padding="md">
        <ParamEditor {...props} />
      </Container>
    );
  },
  args: {
    defaultValues: {
      standalone: "Quick setting",
      temp: 0.8,
      model: "gpt-4",
      env: "production",
    },
    onChange: () => {},
    params: [
      {
        id: "standalone",
        name: "Quick Setting",
        type: "text",
        description: "A standalone parameter outside of groups",
        defaultValue: "Quick setting",
        singleLine: true,
      },
    ],
    groups: [
      {
        id: "model-config",
        title: "Model Configuration",
        collapsible: false,
        description: "Settings related to AI model configuration",
        params: [
          {
            id: "temp",
            name: "Temperature",
            type: "number",
            description: "Model temperature",
            defaultValue: 0.8,
            min: 0,
            max: 1,
            step: 0.1,
          },
          {
            id: "model",
            name: "Model",
            type: "selection",
            description: "Choose the AI model",
            defaultValue: "gpt-4",
            options: [
              { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
              { id: "gpt-4", name: "GPT-4" },
              { id: "claude-3", name: "Claude 3" },
            ],
          },
        ],
      },
      {
        id: "deployment",
        title: "Deployment",
        collapsible: true,
        defaultCollapsed: false,
        description: "Settings related to deployment environment",
        params: [
          {
            id: "env",
            name: "Environment",
            type: "selection",
            description: "Deployment environment",
            defaultValue: "staging",
            options: [
              { id: "development", name: "Development" },
              { id: "staging", name: "Staging" },
              { id: "production", name: "Production" },
            ],
          },
        ],
      },
    ],
    readOnly: false,
  },
};

export const SelectionsWithIcons: Story = {
  render: (props) => {
    return (
      <Container padding="md">
        <ParamEditor {...props} />
      </Container>
    );
  },
  args: {
    defaultValues: {
      "1": "user",
      "2": ["javascript", "typescript"],
      "3": "home-2",
      "4": ["high", "medium"],
    },
    onChange: () => {},
    params: [
      {
        id: "1",
        name: "User Role",
        type: "selection",
        description: "Select a user role with icons",
        defaultValue: "user",
        options: [
          { id: "user", name: "User", icon: "user" },
          { id: "assistant", name: "Assistant", icon: "code" },
          { id: "system", name: "System", icon: "component" },
          { id: "admin", name: "Administrator", icon: "teacher" },
        ],
      },
      {
        id: "2",
        name: "Programming Languages",
        type: "selection",
        description: "Choose programming languages with icons",
        defaultValue: ["javascript", "typescript"],
        multiSelect: true,
        options: [
          { id: "javascript", name: "JavaScript", icon: "code" },
          { id: "typescript", name: "TypeScript", icon: "code-1" },
          { id: "python", name: "Python", icon: "code-circle" },
          { id: "java", name: "Java", icon: "document-code" },
          { id: "csharp", name: "C#", icon: "component" },
        ],
      },
      {
        id: "3",
        name: "Navigation Section",
        type: "selection",
        description: "Choose a navigation section with icons",
        defaultValue: "home-2",
        options: [
          { id: "home-2", name: "Home", icon: "home-2" },
          { id: "folder-2", name: "Projects", icon: "folder-2" },
          { id: "user", name: "Profile", icon: "user" },
          { id: "wallet-2", name: "Billing", icon: "wallet-2" },
          { id: "component", name: "Settings", icon: "component" },
        ],
      },
      {
        id: "4",
        name: "Priority Levels",
        type: "selection",
        description: "Select priority levels with status icons",
        defaultValue: ["high"],
        multiSelect: true,
        options: [
          { id: "low", name: "Low Priority", icon: "arrow-down" },
          { id: "medium", name: "Medium Priority", icon: "minus" },
          { id: "high", name: "High Priority", icon: "arrow-up-3" },
          { id: "urgent", name: "Urgent", icon: "danger" },
        ],
      },
    ],
    readOnly: false,
  },
};

export const FullWidth: Story = {
  render: (props) => {
    return (
      <Container padding="md">
        <ParamEditor {...props} />
      </Container>
    );
  },
  args: {
    defaultValues: {
      "1": 0.7,
      "2": "You are a helpful assistant",
      "3": "user",
      "4": "2024-01-01",
    },
    onChange: () => {},
    params: [
      {
        id: "1",
        name: "Temperature",
        type: "number",
        description: "Controls randomness in the output",
        defaultValue: 0.7,
        min: 0,
        max: 2,
        step: 0.1,
      },
      {
        id: "2",
        name: "System Message",
        type: "text",
        description: "System-level instructions for the AI",
        defaultValue: "You are a helpful assistant",
        singleLine: true,
      },
      {
        id: "3",
        name: "User Role",
        type: "selection",
        description: "Select a user role",
        defaultValue: "user",
        options: [
          { id: "user", name: "User", icon: "user" },
          { id: "assistant", name: "Assistant", icon: "code" },
          { id: "system", name: "System", icon: "component" },
        ],
      },
      {
        id: "4",
        name: "Start Date",
        type: "date",
        description: "Project start date",
        defaultValue: "2024-01-01",
      },
    ],
    fullWidth: true,
    readOnly: false,
  },
};

export const GroupsWithSeparators: Story = {
  render: (props) => {
    return (
      <Container padding="md">
        <ParamEditor {...props} />
      </Container>
    );
  },
  args: {
    defaultValues: {
      temp: 0.7,
      maxTokens: 150,
      systemMsg: "You are a helpful assistant",
      role: "assistant",
      startDate: "2024-01-01",
      apiUrl: "https://api.example.com",
    },
    onChange: () => {},
    groups: [
      {
        id: "model-settings",
        title: "Model Configuration",
        description: "Configure model parameters and behavior",
        params: [
          {
            id: "temp",
            name: "Temperature",
            type: "number",
            description: "Controls randomness in the output",
            defaultValue: 0.7,
            min: 0,
            max: 2,
            step: 0.1,
          },
          {
            id: "maxTokens",
            name: "Max Tokens",
            type: "number",
            description: "Maximum number of tokens to generate",
            defaultValue: 150,
            min: 1,
            max: 1000,
            step: 1,
          },
        ],
      },
      {
        id: "prompt-settings",
        title: "Prompt Configuration",
        description: "Customize prompt behavior and context",
        params: [
          {
            id: "systemMsg",
            name: "System Message",
            type: "text",
            description: "System-level instructions",
            defaultValue: "You are a helpful assistant",
            singleLine: true,
          },
          {
            id: "role",
            name: "Assistant Role",
            type: "selection",
            description: "Choose the assistant's role",
            defaultValue: "assistant",
            options: [
              { id: "assistant", name: "Assistant", icon: "code" },
              { id: "teacher", name: "Teacher", icon: "teacher" },
              { id: "consultant", name: "Consultant", icon: "user" },
            ],
          },
        ],
      },
      {
        id: "api-settings",
        title: "API Configuration",
        description: "Configure API endpoints and timing",
        params: [
          {
            id: "apiUrl",
            name: "API Endpoint",
            type: "text",
            description: "Base URL for API requests",
            defaultValue: "https://api.example.com",
            singleLine: true,
          },
          {
            id: "startDate",
            name: "Start Date",
            type: "date",
            description: "Project start date",
            defaultValue: "2024-01-01",
          },
        ],
      },
    ],
    fullWidth: true,
    readOnly: false,
  },
};
