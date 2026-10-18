export type PropsStore<TProps = unknown> = {
  get: () => TProps;
  subscribe: (listener: (props: TProps) => void) => () => void;
};
