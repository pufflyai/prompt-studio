import { Kbd } from "@chakra-ui/react";
import { Fragment } from "react";

const splitShortcutStep = (step: string) =>
  step
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);

export const getShortcutDisplayTokens = (binding: string) => [splitShortcutStep(binding)];

export const ShortcutKbd = (props: { binding: string }) => {
  const steps = getShortcutDisplayTokens(props.binding);

  return (
    <>
      {steps.map((step, stepIndex) => (
        <Fragment key={`${step.join("+")}-${stepIndex}`}>
          {step.map((label, partIndex) => (
            <Fragment key={`${label}-${partIndex}`}>
              <Kbd fontSize="xs" borderRadius="0" display="inline-flex" alignItems="center" aria-label={label}>
                {label}
              </Kbd>
              {partIndex < step.length - 1 ? " + " : null}
            </Fragment>
          ))}
        </Fragment>
      ))}
    </>
  );
};
