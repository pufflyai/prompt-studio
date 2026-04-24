import { Kbd } from "@chakra-ui/react";
import { Fragment } from "react";
import type { ShortcutBinding } from "./shortcut-registry";

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

export const ShortcutKbd = (props: { binding: ShortcutBinding }) => {
  const { binding } = props;
  const steps = getShortcutTokens(binding);

  return (
    <>
      {steps.map((step, stepIndex) => (
        <Fragment key={`${step.join("+")}-${stepIndex}`}>
          {step.map((part, partIndex) => (
            <Fragment key={`${part}-${partIndex}`}>
              <Kbd fontSize="xs">{part}</Kbd>
              {partIndex < step.length - 1 ? " + " : null}
            </Fragment>
          ))}
          {stepIndex < steps.length - 1 ? " then " : null}
        </Fragment>
      ))}
    </>
  );
};
