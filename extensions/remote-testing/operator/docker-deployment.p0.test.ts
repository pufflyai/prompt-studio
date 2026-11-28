import { expect, test } from "bun:test";
import { dockerDeployment } from "./docker-deployment";

const digest = (character: string) => `sha256:${character.repeat(64)}`;

const config = (workspaceImage: string) => ({
  images: [workspaceImage],
  daemonImage: `docker.io/library/docker@${digest("b")}`,
  nodeSelector: { "pocketcoder.dev/pool": "trusted-tests" },
  namespace: "remote-tests",
  caBundle: "ca",
  image: `admission@${digest("c")}`,
});

type Rendered = {
  items: { kind: string; spec?: { template?: { metadata?: { annotations?: Record<string, string> } } } }[];
};

const checksum = (workspaceImage: string) => {
  const rendered = dockerDeployment(config(workspaceImage)) as unknown as Rendered;
  const deployment = rendered.items.find((item) => item.kind === "Deployment");
  return deployment?.spec?.template?.metadata?.annotations?.["pocketcoder.dev/policy-checksum"];
};

test("rolls admission Pods out when the approved image policy changes", () => {
  const first = checksum(`workspace@${digest("a")}`);
  expect(first).toBeString();
  expect(checksum(`workspace@${digest("a")}`)).toBe(first);
  expect(checksum(`workspace@${digest("d")}`)).not.toBe(first);
});
