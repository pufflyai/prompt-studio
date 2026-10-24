import { createContext, type ReactNode, useContext } from "react";

const FittedDemoContext = createContext(false);

/** Walkthroughs share available height; standalone examples keep content sizing. */
export const FittedDemo = (props: { children: ReactNode }) => {
  const { children } = props;
  return <FittedDemoContext value>{children}</FittedDemoContext>;
};

export const useFittedDemo = () => useContext(FittedDemoContext);
