import { expect } from "@playwright/test";
import { classifyRuntimeFailure } from "../runtime/runtime-controller";
import { test } from "../testing/packaged-fixture";
import {
  createPackagedHome,
  readDescriptor,
  removePackagedHome,
  runPackagedCli,
  waitForDescriptor,
} from "./packaged-app-helpers";

test("refuses a second packaged runtime on an occupied loopback port", async () => {
  const ownerHome = createPackagedHome();
  const contenderHome = createPackagedHome();
  try {
    expect(await runPackagedCli(ownerHome, ["serve"])).toMatchObject({ exitCode: 0 });
    const owner = await waitForDescriptor(ownerHome);
    const contender = await runPackagedCli(contenderHome, [
      "serve",
      "--foreground",
      "--owner",
      "desktop",
      "--instance-id",
      "occupied-port-contender",
      "--host",
      "127.0.0.1",
      "--port",
      new URL(owner.origin).port,
    ]);
    expect(contender.exitCode).not.toBe(0);
    await test
      .info()
      .attach("occupied-port-output", { body: `${contender.stdout}\n${contender.stderr}`, contentType: "text/plain" });
    expect(classifyRuntimeFailure(`${contender.stdout}\n${contender.stderr}`).code).toBe("port_bind_failure");
    expect(readDescriptor(contenderHome)).toBeNull();
    expect(readDescriptor(ownerHome)).toEqual(owner);
    expect(
      (await fetch(`${owner.origin}/runtime/ready`, { headers: { authorization: `Bearer ${owner.token}` } })).ok,
    ).toBe(true);
    expect(await runPackagedCli(ownerHome, ["close"])).toMatchObject({ exitCode: 0 });
  } finally {
    removePackagedHome(contenderHome);
    removePackagedHome(ownerHome);
  }
});
