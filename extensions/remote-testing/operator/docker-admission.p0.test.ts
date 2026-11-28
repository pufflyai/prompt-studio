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

test("equips an approved test Pod with a dedicated daemon", () => {
  const patch = dockerPatch(pod(`test@${digest("a")}`), policy);
  expect(JSON.stringify(patch)).toContain("test-docker");
  expect(JSON.stringify(patch)).toContain("trusted-tests");
});
