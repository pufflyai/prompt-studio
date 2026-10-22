import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
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

export const startContainerRuntime = async (config: ContainerRuntime) => {
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
