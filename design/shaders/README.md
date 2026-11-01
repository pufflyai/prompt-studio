# Shader studies in UI Canvas

Run `bun run canvas`, then open **Shaders** in UI Canvas. Select a frame and open **Parameters**. Changes stay temporary until **Save** updates the selected JSON version or **Save as new version** creates a named sibling file. Reset restores that version. Rename and delete are explicit actions; the version imported by the canvas cannot be deleted from its Parameters menu.

Versions remain at `design/shaders/<shader>/<version>.json` with `name` and numeric `values`. Each shader's `shader.canvas.tsx` supplies Preview and Compare frames. Version and theme choices are independent. A previous Shader Lab comparison choice is imported when Compare first opens. Saving errors keep edits available for retry.

`catalog.json` defines shader ids, fields, bounds, steps, and defaults. `library/` owns the project renderers. Motion is driven by Canvas time, including CSS animation seeks, so paused frames do no continuous work. No shader compiler runs in the extension.

```sh
pst canvas shaders list
pst canvas shaders add --shader dots-to-grid
pst canvas version read --shader section-hatch --version default
pst canvas version update --shader section-hatch --version default --values '{"noiseScale":320}'
pst canvas version duplicate --shader section-hatch --version default --name "Large patches"
pst canvas version rename --shader section-hatch --version large-patches --name "Soft patches"
pst canvas version delete --shader section-hatch --version large-patches
```

Deleting the last version removes its canvas; adding the shader restores it with defaults. Keep lines neutral and faint. Avoid colored glows or animated text.
