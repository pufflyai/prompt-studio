import { Button, Flex, Text } from "@chakra-ui/react";
import { createWebviewClient, type GuestHost } from "@pstdio/sdk/extensions";
import { Header, ScrollArea } from "@pstdio/ui";
import { ParamEditor, type ParamValue } from "@pstdio/ui/param-editor";
import { useEffect, useState } from "react";
import { defaultRecipe, type Recipe } from "../art/recipe";
import type { commands } from "../commands";
import { piecesChanged } from "../events";
import { ArtCanvas } from "./art-canvas";
import { applyChange, recipeGroups } from "./recipe-controls";

interface StudioProps {
  host: GuestHost;
}

type PieceSummary = Awaited<ReturnType<(typeof commands)["piece.list"]["run"]>>["pieces"][number];

const NEW_PIECE = "new";

export const Studio = (props: StudioProps) => {
  const { host } = props;
  const client = createWebviewClient<typeof commands>(host);
  const [pieces, setPieces] = useState<PieceSummary[]>([]);
  const [selected, setSelected] = useState(NEW_PIECE);
  const [id, setId] = useState("untitled");
  const [recipe, setRecipe] = useState<Recipe>(defaultRecipe);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const client = createWebviewClient<typeof commands>(host);
    let active = true;
    const refresh = async () => {
      const { pieces } = await client.commands["piece.list"]({});
      if (active) setPieces(pieces);
    };
    const unsubscribe = client.events.subscribe(piecesChanged, () => void refresh());
    void refresh();
    return () => {
      active = false;
      unsubscribe();
    };
  }, [host]);

  const run = async (operation: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await operation();
      await host.call("notification.show", { level: "success", title: "Shape Art", message: success });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      await host.call("notification.show", { level: "error", title: "Shape Art", message });
    } finally {
      setBusy(false);
    }
  };

  const open = async (pieceId: string) => {
    setSelected(pieceId);
    if (pieceId === NEW_PIECE) {
      setId("untitled");
      setRecipe(defaultRecipe());
      return;
    }
    const piece = await client.commands["piece.read"]({ id: pieceId });
    setId(piece.id);
    setRecipe(piece.recipe);
  };

  const change = (paramId: string, value: ParamValue) => {
    if (paramId === "piece") void open(String(value));
    else if (paramId === "id") setId(String(value));
    else setRecipe((current) => applyChange(current, paramId, value));
  };

  const save = () =>
    run(async () => {
      await client.commands["piece.save"]({ id, recipe });
      setSelected(id);
    }, `Saved design/art/${id}.png`);

  const remove = () =>
    run(async () => {
      await client.commands["piece.delete"]({ id: selected });
      await open(NEW_PIECE);
    }, `Deleted ${selected}`);

  const pieceGroup = {
    id: "piece",
    title: "Piece",
    params: [
      {
        id: "piece",
        name: "Open",
        type: "selection" as const,
        defaultValue: selected,
        options: [{ id: NEW_PIECE, name: "New piece" }, ...pieces.map((piece) => ({ id: piece.id, name: piece.id }))],
      },
      {
        id: "id",
        name: "File name",
        type: "text" as const,
        singleLine: true,
        defaultValue: id,
        description: "Saves to design/art/<file name>.json and .png",
      },
    ],
  };

  return (
    <Flex h="full" minH="0" minW="0" overflow="hidden" bg="bg" color="fg">
      <Flex direction="column" flex="1" minH="0" minW="0" bg="bg.subtle">
        <Header flexShrink="0" borderBottomWidth="1px" borderColor="border.subtle" px="sm" gap="xs">
          <Text textStyle="label/M/medium" flex="1" truncate>
            {id}
          </Text>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setRecipe((current) => ({ ...current, seed: Math.random().toString(36).slice(2, 8) }))}
          >
            New seed
          </Button>
          {selected !== NEW_PIECE ? (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void remove()}>
              Delete
            </Button>
          ) : null}
          <Button size="sm" disabled={busy} onClick={() => void save()}>
            Save
          </Button>
        </Header>
        <ArtCanvas recipe={recipe} label={id} />
      </Flex>
      <ScrollArea
        w="20rem"
        flexShrink="0"
        borderLeftWidth="1px"
        borderColor="border.subtle"
        viewportProps={{ "aria-label": "Art settings" }}
      >
        <ParamEditor groups={[pieceGroup, ...recipeGroups(recipe)]} onChange={change} />
      </ScrollArea>
    </Flex>
  );
};
