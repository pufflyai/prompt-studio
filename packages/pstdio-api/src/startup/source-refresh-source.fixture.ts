import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTestExtensionSource } from "../features/extensions/test-utils/create-test-extension-source";

export const prepareSourceRefreshFixture = (root: string) => {
  const source = createTestExtensionSource({
    root,
    name: "startup-fixture",
    installName: "startup-fixture",
    displayName: "Startup fixture",
  });
  writeFileSync(
    join(source, "extension.ts"),
    `export default {commands:[{id:"ready",ref:{kind:"command",id:"ready"},title:"Ready",run:()=>"ready"}]};`,
  );
  writeFileSync(join(source, "README.md"), "Startup source fixture\n");
  return source;
};
