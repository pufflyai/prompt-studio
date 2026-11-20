import { Box, useRecipe } from "@chakra-ui/react";
import { useEffect, useRef } from "react";
import { IsoScene, type World } from "../../services/iso/scene";
import { landingIsoRecipe } from "../../theme/recipes/landing-iso";

interface IsoSceneViewProps {
  world: World;
  setup: (scene: IsoScene) => void;
  label: string;
}

/** Mounts an isometric scene; the engine owns its DOM and loops until unmount. */
export const IsoSceneView = (props: IsoSceneViewProps) => {
  const { world, setup, label } = props;
  const ref = useRef<HTMLDivElement>(null);
  const styles = useRecipe({ recipe: landingIsoRecipe })();

  useEffect(() => {
    const scene = new IsoScene(ref.current!, world);
    setup(scene);
    return () => scene.dispose();
  }, [world, setup]);

  return <Box ref={ref} css={styles} role="img" aria-label={label} />;
};
