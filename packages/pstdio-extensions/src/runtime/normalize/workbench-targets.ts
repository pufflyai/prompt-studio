import {
  getWorkbenchTargetDefinition,
  type WorkbenchContributionKind,
  workbenchTargets,
} from "pstdio-api-contracts/extension-kernel";
import { createDiagnostic } from "../diagnostics";
import type { Accumulator } from "./accumulator";

const targetId = (target: unknown) => (typeof target === "string" ? target : undefined);

const supportedTargetsFor = (kind: WorkbenchContributionKind) =>
  workbenchTargets
    .filter((target) => (target.allowedKinds as readonly WorkbenchContributionKind[]).includes(kind))
    .map((target) => target.id);

export const hasCompatibleWorkbenchTarget = (input: {
  runtime: Accumulator;
  source: { extensionId: string; sourcePath: string };
  expected: WorkbenchContributionKind;
  target: unknown;
  contributionId: string;
}) => {
  const { contributionId, expected, runtime, source, target } = input;
  const id = targetId(target);
  if (!id) return true;

  const definition = getWorkbenchTargetDefinition(id);
  if (!definition) {
    runtime.diagnostics.push(
      createDiagnostic({
        code: "extension_target_invalid",
        message: `Contribution "${contributionId}" targets unknown workbench target "${id}"`,
        extensionId: source.extensionId,
        sourcePath: source.sourcePath,
        metadata: {
          contributionId,
          expectedKind: expected,
          supportedTargets: supportedTargetsFor(expected),
          target: id,
        },
      }),
    );
    return false;
  }

  if ((definition.allowedKinds as readonly WorkbenchContributionKind[]).includes(expected)) return true;

  runtime.diagnostics.push(
    createDiagnostic({
      code: "extension_target_unsupported",
      message: `Contribution "${contributionId}" targets "${id}" as ${expected}; supported targets are ${supportedTargetsFor(expected).join(", ")}`,
      extensionId: source.extensionId,
      sourcePath: source.sourcePath,
      metadata: {
        contributionId,
        expectedKind: expected,
        supportedTargets: supportedTargetsFor(expected),
        target: id,
      },
    }),
  );
  return false;
};

export const hasRequiredWorkbenchTarget = (input: {
  runtime: Accumulator;
  source: { extensionId: string; sourcePath: string };
  expected: WorkbenchContributionKind;
  target: unknown;
  contributionId: string;
}) => {
  const { contributionId, expected, runtime, source, target } = input;
  if (targetId(target)) return hasCompatibleWorkbenchTarget(input);

  runtime.diagnostics.push(
    createDiagnostic({
      code: "extension_target_invalid",
      message: `Contribution "${contributionId}" must declare a workbench target`,
      extensionId: source.extensionId,
      sourcePath: source.sourcePath,
      metadata: {
        contributionId,
        expectedKind: expected,
        supportedTargets: supportedTargetsFor(expected),
      },
    }),
  );
  return false;
};
