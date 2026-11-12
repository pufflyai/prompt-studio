export default {
  commands: [{ id: "heartbeat", ref: { kind: "command", id: "heartbeat" }, title: "Heartbeat", run: () => {} }],
  schedules: [
    {
      id: "heartbeat",
      ref: { kind: "schedule", id: "heartbeat" },
      title: "Contract heartbeat",
      schedule: "0 3 * * *",
      command: { kind: "command", id: "heartbeat" },
    },
  ],
};
