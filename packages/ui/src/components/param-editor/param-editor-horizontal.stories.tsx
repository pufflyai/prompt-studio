import { Container } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { ParamEditorHorizontal } from "./param-editor-horizontal";

const meta = {
  title: "Components/Inputs/Param Editor Horizontal",
  component: ParamEditorHorizontal,
  parameters: {
    layout: "fullscreen",
  },
  tags: [],
  argTypes: {},
} satisfies Meta<typeof ParamEditorHorizontal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Demo: Story = {
  render: (props) => {
    return (
      <Container padding="md">
        <ParamEditorHorizontal {...props} />
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

export const ReadOnly: Story = {
  render: (props) => {
    return (
      <Container padding="md">
        <ParamEditorHorizontal {...props} />
      </Container>
    );
  },
  args: {
    defaultValues: {
      "1": 0.7,
      "2": "You are a helpful assistant",
      "3": "assistant",
      "4": "2024-07-30",
      "5": "#1a73e8",
    },
    onChange: () => {},
    params: [
      {
        id: "1",
        name: "Temperature",
        type: "number",
        description: "Model temperature setting",
        defaultValue: 0.7,
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
      },
      {
        id: "3",
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
        id: "4",
        name: "Deadline",
        type: "date",
        description: "Project deadline",
        defaultValue: "2024-07-30",
      },
      {
        id: "5",
        name: "Theme Color",
        type: "color",
        description: "Theme color",
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
        <ParamEditorHorizontal {...props} />
      </Container>
    );
  },
  args: {
    defaultValues: {
      "1": "2024-07-30",
      "2": "2024-01-01",
      "3": "2025-12-31",
      "4": "user",
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
        name: "Role",
        type: "selection",
        description: "Select a role for comparison",
        defaultValue: "user",
        options: [
          { id: "user", name: "User" },
          { id: "assistant", name: "Assistant" },
          { id: "system", name: "System" },
        ],
      },
    ],
    readOnly: false,
  },
};

export const MultiSelectExample: Story = {
  render: (props) => {
    return (
      <Container padding="md">
        <ParamEditorHorizontal {...props} />
      </Container>
    );
  },
  args: {
    defaultValues: {
      "1": 0.7,
      "2": ["javascript", "python"],
      "3": "assistant",
      "4": [],
      "5": "2024-12-31",
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
        name: "Languages",
        type: "selection",
        description: "Select multiple programming languages",
        defaultValue: ["javascript", "python"],
        multiSelect: true,
        placeholder: "Languages...",
        options: [
          { id: "javascript", name: "JavaScript" },
          { id: "python", name: "Python" },
          { id: "typescript", name: "TypeScript" },
          { id: "java", name: "Java" },
          { id: "csharp", name: "C#" },
        ],
      },
      {
        id: "3",
        name: "Role",
        type: "selection",
        description: "Select a single role",
        defaultValue: "assistant",
        options: [
          { id: "user", name: "User" },
          { id: "assistant", name: "Assistant" },
          { id: "system", name: "System" },
        ],
      },
      {
        id: "4",
        name: "Priorities",
        type: "selection",
        description: "Select multiple priority levels",
        defaultValue: [],
        multiSelect: true,
        placeholder: "Priorities...",
        options: [
          { id: "low", name: "Low" },
          { id: "medium", name: "Medium" },
          { id: "high", name: "High" },
          { id: "urgent", name: "Urgent" },
        ],
      },
      {
        id: "5",
        name: "Deadline",
        type: "date",
        description: "Project deadline date",
        defaultValue: "2024-12-31",
        min: "2024-01-01",
        max: "2025-12-31",
      },
    ],
    readOnly: false,
  },
};

export const WithInputGroups: Story = {
  render: (props) => {
    return (
      <Container padding="md">
        <ParamEditorHorizontal {...props} />
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
      timeout: 30,
    },
    onChange: () => {},
    groups: [
      {
        id: "llm-settings",
        title: "LLM Configuration",
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
        id: "api-config",
        title: "API Settings",
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
        <ParamEditorHorizontal {...props} />
      </Container>
    );
  },
  args: {
    defaultValues: {
      standalone: "Quick setting",
      temp: 0.8,
      model: "gpt-4",
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
    ],
    readOnly: false,
  },
};

export const SelectionsWithIcons: Story = {
  render: (props) => {
    return (
      <Container padding="md">
        <ParamEditorHorizontal {...props} />
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

export const FullWidthNoEffect: Story = {
  render: (props) => {
    return (
      <Container padding="md">
        <ParamEditorHorizontal {...props} />
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
