import {
  defineExtension,
  defineNavigationItem,
  defineNavigationTree,
  definePage,
  defineResourceKind,
  defineView,
  workbenchModes,
} from "@pstdio/sdk/extensions";

const recipe = defineResourceKind({ id: "recipe", label: "Recipe", icon: "ChefHat" });
const recipes = [
  { id: "pancakes", title: "Pancakes" },
  { id: "ramen", title: "Ramen" },
];

const markdown = (id: string, title: string) =>
  defineView({
    id,
    title,
    body: {
      kind: "file",
      load: async (_ctx, { renderer }) => ({
        fileName: `${id}.md`,
        mimeType: "text/markdown",
        content: `# ${renderer.resource?.label ?? title}`,
      }),
    },
  });
const pantryView = markdown("pantry", "Pantry");
const recipeView = markdown("recipe", "Recipes");

export const pantryPage = definePage({
  id: "pantry",
  title: "Pantry",
  path: "pantry",
  mode: workbenchModes.project,
  main: { kind: "view", view: pantryView.ref, cardinality: "one" },
  slots: [],
});
// Opening this page starts the Recipes level.
const recipesPage = definePage({
  id: "recipes",
  title: "Recipes",
  path: "recipes",
  mode: workbenchModes.project,
  main: { kind: "view", view: recipeView.ref, cardinality: "one" },
  slots: [],
});
// A child page keeps the Recipes level open through its declared parent.
const recipePage = definePage({
  id: "recipe",
  title: "Recipe",
  path: "recipe",
  mode: workbenchModes.project,
  parent: recipesPage.ref,
  resource: { kinds: [recipe.ref] },
  main: { kind: "view", view: recipeView.ref, cardinality: "one" },
  slots: [],
});

const recipeList = defineView({
  id: "recipe-list",
  title: "Recipes",
  body: {
    kind: "tree",
    body: async () => [
      {
        id: "recipes",
        label: "Recipes",
        collapsible: false,
        nodes: recipes.map(({ id, title }) => {
          const resource = { type: recipe.id, id, label: title };
          return {
            id,
            label: title,
            icon: "ChefHat",
            resource,
            target: { kind: "page", page: recipePage.ref, resource },
          };
        }),
      },
    ],
  },
});

export default defineExtension({
  resourceKinds: [recipe],
  views: [pantryView, recipeView, recipeList],
  pages: [pantryPage, recipesPage, recipePage],
  navigationItems: [
    // Header rows stay visible in every level.
    defineNavigationItem({
      id: "pantry",
      owner: workbenchModes.project,
      slot: "header",
      label: "Pantry",
      icon: "ShoppingBasket",
      action: { kind: "page", page: pantryPage.ref },
    }),
    // The main level shows one row that opens the level.
    defineNavigationItem({
      id: "recipes",
      owner: workbenchModes.project,
      slot: "content",
      label: "Recipes",
      icon: "ChefHat",
      group: "",
      action: { kind: "page", page: recipesPage.ref },
    }),
  ],
  navigationTrees: [
    // A page owner starts a level instead of adding rows to the project navigation.
    defineNavigationTree({
      id: "recipe-list",
      owner: recipesPage.ref,
      slot: "content",
      view: recipeList.ref,
      resourceScope: "project",
    }),
  ],
});
