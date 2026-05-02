import { Kbd } from "@chakra-ui/react";
import { Fragment } from "react";
import type { ShortcutBinding } from "./shortcut-registry";

export type ShortcutDisplayPart = { label: string };

const splitShortcutStep = (step: string) => {
  return step
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);
};

export const getShortcutTokens = (binding: ShortcutBinding) => {
  if (Array.isArray(binding)) {
    return binding.map(splitShortcutStep);
  }

  return [splitShortcutStep(binding)];
};

export const getShortcutDisplayTokens = (binding: ShortcutBinding) => {
  return getShortcutDisplayParts(binding).map((step) => step.map((part) => part.label));
};

export const getShortcutDisplayParts = (binding: ShortcutBinding) => {
  return getShortcutTokens(binding).map((step) =>
    step.map((token) => ({ label: token }) satisfies ShortcutDisplayPart),
  );
};

export const ShortcutKbd = (props: { binding: ShortcutBinding }) => {
  const { binding } = props;
  const steps = getShortcutDisplayParts(binding);

  return (
    <>
      {steps.map((step, stepIndex) => (
        <Fragment key={`${step.map((part) => part.label).join("+")}-${stepIndex}`}>
          {step.map((part, partIndex) => (
            <Fragment key={`${part.label}-${partIndex}`}>
              <Kbd fontSize="xs" borderRadius="0" display="inline-flex" alignItems="center" aria-label={part.label}>
                {part.label}
              </Kbd>
              {partIndex < step.length - 1 ? " + " : null}
            </Fragment>
          ))}
          {stepIndex < steps.length - 1 ? " then " : null}
        </Fragment>
      ))}
    </>
  );
};
