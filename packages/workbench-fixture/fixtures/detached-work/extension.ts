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
      const record = (event, detail = {}) => {
        try {
          fs.appendFileSync(path + ".events", JSON.stringify({
            event, pid: process.pid, parentPid: process.ppid, tick, time: Date.now(), ...detail
          }) + "\\n");
        } catch {}
      };
      record("started");
      process.on("uncaughtExceptionMonitor", error => record("uncaught-error", {
        message: String(error), code: error.code, stack: error.stack
      }));
      process.on("exit", code => record("exit", { code }));
      const timer = setInterval(() => {
        fs.writeFileSync(path + ".tmp", JSON.stringify({ pid: process.pid, tick: ++tick }));
        fs.renameSync(path + ".tmp", path);
      }, 50);
      setTimeout(() => { record("lifetime-ended"); clearInterval(timer); process.exit(0); }, 10000);
    `;
    return ctx.process.spawnDetached({ command: [input.executable, "--eval", script] });
  },
});

export default defineExtension({ commands: [detachedProbeCommand] });
