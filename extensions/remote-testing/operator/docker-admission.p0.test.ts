import { expect, test } from "bun:test";
import { dockerPatch } from "./docker-admission";

const digest = (character: string) => `sha256:${character.repeat(64)}`;

const policy = {
  images: [`test@${digest("a")}`],
  daemonImage: `docker@${digest("b")}`,
  nodeSelector: { "pocketcoder.dev/pool": "trusted-tests" },
};

const pod = (image: string) => ({
  metadata: {
    labels: { "pocketcoder.workspace": "workspace-1" },
    ownerReferences: [{ kind: "Job", controller: true }],
  },
  spec: {
    containers: [
      {
        name: "workspace",
        image,
        volumeMounts: [{ name: "workspace", mountPath: "/workspace" }],
      },
    ],
    volumes: [{ name: "workspace" }],
  },
});

test("denies a newer test image until the admission policy rolls out", () => {
  expect(() => dockerPatch(pod(`test@${digest("c")}`), policy)).toThrow("admission policy");
});

test("denies a probe image the running policy does not approve", () => {
  const probe = {
    metadata: {
      labels: { "pocketcoder.dev/workload-probe": "true" },
      ownerReferences: [{ kind: "Job", controller: true }],
    },
    spec: { containers: [{ name: "probe", image: `test@${digest("c")}` }] },
  };
  expect(() => dockerPatch(probe, policy)).toThrow("probe image");
});

test("schedules an approved probe on the trusted pool without Docker", () => {
  const probe = {
    metadata: { labels: { "pocketcoder.dev/workload-probe": "true" } },
    spec: { containers: [{ name: "probe", image: `test@${digest("a")}` }] },
  };
  const patch = dockerPatch(probe, policy);
  expect(JSON.stringify(patch)).toContain("trusted-tests");
  expect(JSON.stringify(patch)).not.toContain("test-docker");
});

test("equips an approved test Pod with a dedicated daemon", () => {
  const patch = dockerPatch(pod(`test@${digest("a")}`), policy);
  expect(JSON.stringify(patch)).toContain("test-docker");
  expect(JSON.stringify(patch)).toContain("trusted-tests");
});
