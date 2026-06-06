import { defineCommand } from "@pstdio/sdk/extensions";

const resourceKind = "glass-lab-artifact";

const artifactRows = [
  {
    id: "glass-interview-room",
    title: "Glass interview room",
    resource: {
      type: resourceKind,
      id: "glass-interview-room",
      label: "Glass interview room",
      icon: "PanelTop",
      metadata: { role: "observation", trustSignal: 92 },
    },
    attributes: {
      role: "observation",
      trustSignal: 92,
      status: "active",
    },
  },
  {
    id: "turing-session-deck",
    title: "Turing session deck",
    resource: {
      type: resourceKind,
      id: "turing-session-deck",
      label: "Turing session deck",
      icon: "BrainCircuit",
      metadata: { role: "evaluation", trustSignal: 76 },
    },
    attributes: {
      role: "evaluation",
      trustSignal: 76,
      status: "active",
    },
  },
  {
    id: "remote-facility-keycard",
    title: "Remote facility keycard",
    resource: {
      type: resourceKind,
      id: "remote-facility-keycard",
      label: "Remote facility keycard",
      icon: "KeyRound",
      metadata: { role: "access", trustSignal: 58 },
    },
    attributes: {
      role: "access",
      trustSignal: 58,
      status: "locked",
    },
  },
];

export const queryGlassLabArtifactsCommand = defineCommand({
  title: "Query Glass Lab artifacts",
  async run() {
    return {
      rows: artifactRows,
      attributes: [
        {
          id: "role",
          label: "Role",
          type: {
            kind: "enum",
            options: [
              { value: "observation", label: "Observation", color: "blue", icon: "panel-top" },
              { value: "evaluation", label: "Evaluation", color: "purple", icon: "brain-circuit" },
              { value: "access", label: "Access", color: "yellow", icon: "key-round" },
            ],
          },
          displayable: true,
          filterable: true,
          groupable: true,
        },
        {
          id: "trustSignal",
          label: "Trust signal",
          type: { kind: "number" },
          displayable: true,
          sortable: true,
        },
        {
          id: "status",
          label: "Status",
          type: {
            kind: "enum",
            options: [
              { value: "active", label: "Active", color: "green", icon: "activity" },
              { value: "locked", label: "Locked", color: "gray", icon: "lock" },
            ],
          },
          displayable: true,
          filterable: true,
        },
      ],
    };
  },
});
