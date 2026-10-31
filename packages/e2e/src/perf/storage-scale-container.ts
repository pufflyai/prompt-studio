import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { contract, type Profile } from "storage-scale-fixture";
import type { RuntimeDescriptor } from "../packaged/packaged-serve-helpers";

export interface ContainerRuntime {
  home: string;
  containerId: string;
  baseUrl: string;
}
const docker = (args: string[]) => execFileSync("docker", args, { encoding: "utf8" }).trim();
const calibrated = new Set<string>();

export const configuredContainer = (home: string) => {
  const path = process.env.PSTDIO_SCALE_CONTAINER_CONFIG;
  if (!path) return;
  const config = JSON.parse(readFileSync(path, "utf8")) as ContainerRuntime;
  if (resolve(config.home) !== resolve(home)) throw new Error("Container configuration and fixture home differ");
  return config;
};

// Output of `getconf CLK_TCK`, `/proc/<pid>/stat` and `/proc/<pid>/status` read inside the container.
export const parseContainerProcess = (output: string) => {
  const [ticksLine = "", stat = "", ...status] = output.split("\n");
  const clockTicks = Number(ticksLine);
  // comm is parenthesized and may itself contain spaces or parentheses.
  const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
  if (!(clockTicks > 0) || fields.length < 20 || fields[0] === "Z") return null;
  const memory = (key: string) => {
    const match = status.join("\n").match(new RegExp(`^${key}:\\s+(\\d+) kB$`, "m"));
    return match ? Number(match[1]) * 1024 : null;
  };
  const residentBytes = memory("VmRSS");
  if (residentBytes === null) return null;
  return {
    processStartId: fields[19]!,
    cpuTimeMs: ((Number(fields[11]) + Number(fields[12])) * 1000) / clockTicks,
    residentBytes,
    peakResidentBytes: memory("VmHWM"),
    physicalFootprintBytes: null,
    peakPhysicalFootprintBytes: null,
    privateCommittedBytes: null,
  };
};

// The runtime's PID belongs to the container's namespace, so its kernel readings come from there too.
export const readContainerProcess = async (config: ContainerRuntime, pid: number) => {
  const read = Bun.spawn(
    ["docker", "exec", config.containerId, "sh", "-c", `getconf CLK_TCK && cat /proc/${pid}/stat /proc/${pid}/status`],
    // A stalled Docker daemon must not hold up the next 2-second sample.
    { stdout: "pipe", stderr: "ignore", timeout: 1_500 },
  );
  const output = await new Response(read.stdout).text();
  // A missing process or a timed-out read exits non-zero; it has no reading.
  if ((await read.exited) !== 0) return null;
  return parseContainerProcess(output);
};

export const applyContainerProfile = (config: ContainerRuntime, profile: Profile) => {
  const cpus = contract.profiles[profile].runtimeCpus ?? 0;
  docker(["update", "--cpus", String(cpus), config.containerId]);
  const inspect = JSON.parse(docker(["inspect", config.containerId]))[0];
  if (inspect.HostConfig.NanoCpus !== cpus * 1_000_000_000) throw new Error("Docker CPU quota did not take effect");
  process.env.PSTDIO_SCALE_EXPECTED_NANO_CPUS = String(inspect.HostConfig.NanoCpus);
  return {
    containerId: config.containerId,
    nanoCpus: inspect.HostConfig.NanoCpus,
    aggregateBoundary: "service cgroup, including extension workers",
    platform: inspect.Platform,
  };
};

const controlEvidence = (config: ContainerRuntime, expected: string | undefined) => {
  const cgroupBefore = docker(["exec", config.containerId, "cat", "/sys/fs/cgroup/cpu.max", "/sys/fs/cgroup/cpu.stat"]);
  const started = performance.now();
  const key = `${config.containerId}/${expected ?? "preparation"}`;
  const calibration: object[] = [];
  if (!calibrated.has(key)) {
    for (let sample = 0; sample < 3; sample++)
      calibration.push(
        JSON.parse(
          docker([
            "exec",
            config.containerId,
            "bun",
            "-e",
            "const t=performance.now(); const cpu=process.cpuUsage(); let x=42; for(let i=0;i<200000000;i++)x=(Math.imul(x,1664525)+1013904223)>>>0; console.log(JSON.stringify({iterations:200000000,checksum:x,durationMs:performance.now()-t,cpu:process.cpuUsage(cpu)}));",
          ]),
        ),
      );
    calibrated.add(key);
  }
  const calibrationMs = performance.now() - started;
  const cgroupAfter = docker(["exec", config.containerId, "cat", "/sys/fs/cgroup/cpu.max", "/sys/fs/cgroup/cpu.stat"]);
  return { cgroupBefore, cgroupAfter, calibration, calibrationMs, expectedNanoCpus: expected ?? null };
};

const readyDescriptor = async (config: ContainerRuntime, previous: string | undefined) => {
  try {
    const descriptor = JSON.parse(readFileSync(resolve(config.home, "runtime.json"), "utf8")) as RuntimeDescriptor;
    if (descriptor.instanceId === previous) return;
    const response = await fetch(`${config.baseUrl}/runtime/ready`, {
      headers: { authorization: `Bearer ${descriptor.token}` },
    });
    if (response.ok && ((await response.json()) as { instanceId: string }).instanceId === descriptor.instanceId)
      return descriptor;
  } catch {
    /* Descriptor replacement and a refused connection are normal during startup. */
  }
};

export const startContainerRuntime = async (config: ContainerRuntime, environment: Record<string, string> = {}) => {
  writeFileSync(resolve(config.home, "scale-environment.json"), JSON.stringify(environment));
  const expected = process.env.PSTDIO_SCALE_EXPECTED_NANO_CPUS;
  if (expected && docker(["inspect", "--format", "{{.HostConfig.NanoCpus}}", config.containerId]) !== expected)
    throw new Error("Runtime CPU quota changed before cold startup");
  let previous: string | undefined;
  try {
    previous = JSON.parse(readFileSync(resolve(config.home, "runtime.json"), "utf8")).instanceId;
  } catch {}
  docker(["restart", config.containerId]);
  while (docker(["inspect", "--format", "{{.State.Running}}", config.containerId]) === "true") {
    const descriptor = await readyDescriptor(config, previous);
    if (descriptor) {
      const evidence = controlEvidence(config, expected);
      return {
        descriptor: { ...descriptor, origin: config.baseUrl },
        baseUrl: config.baseUrl,
        controlEvidence: evidence,
        controlPreparationMs: evidence.calibrationMs,
        completeLoginCallback: async (url: string) => {
          // Login owns a separate loopback listener inside this network namespace.
          const callback = Bun.spawn(
            [
              "docker",
              "exec",
              "-i",
              config.containerId,
              "bun",
              "-e",
              "const response = await fetch((await Bun.stdin.text()).trim()); if (!response.ok) throw new Error('Diagnostic login HTTP ' + response.status);",
            ],
            { stdin: new TextEncoder().encode(url), stdout: "ignore", stderr: "ignore" },
          );
          // Await asynchronously: this process also serves the local TLS peer.
          if ((await callback.exited) !== 0) throw new Error("Completing container diagnostic login failed");
        },
        crash: async () => {
          docker(["kill", "--signal", "KILL", config.containerId]);
        },
        stop: async () => {
          docker(["stop", config.containerId]);
        },
      };
    }
    await Bun.sleep(200);
  }
  throw new Error("Isolated diagnostic runtime exited before readiness; inspect docker logs");
};
