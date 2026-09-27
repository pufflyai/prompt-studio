import { Composition, registerRoot } from "remotion";
import { compositions } from "./registry";

const Root = () => (
  <>
    {compositions.map(({ title: _title, ...composition }) => (
      <Composition key={composition.id} {...composition} />
    ))}
  </>
);
registerRoot(Root);
