import { defineCommand, defineExtension, params } from "@pstdio/sdk/extensions";

const detachedProbeCommand = defineCommand({
  id: "spawn-detached-probe",
  title: "Start a detached process probe",
  params: {
    executable: params.text({ required: true }),
    heartbeatPath: params.text({ required: true }),
  },
  async run(ctx, input) {
    const script = `
      const fs = require("node:fs");
      const path = ${JSON.stringify(input.heartbeatPath)};
      let tick = 0;
      const timer = setInterval(() => {
        fs.writeFileSync(path + ".tmp", JSON.stringify({ pid: process.pid, tick: ++tick }));
        fs.renameSync(path + ".tmp", path);
      }, 50);
      setTimeout(() => { clearInterval(timer); process.exit(0); }, 10000);
    `;
    return ctx.process.spawnDetached({ command: [input.executable, "--eval", script] });
  },
});

export default defineExtension({ commands: [detachedProbeCommand] });
