# Reference sources

Drop the two delivered originals here to make the asset pipeline fully reproducible:

| file | used by |
| --- | --- |
| `master-asset-sheet.png` | `node tools/slice-sheet.mjs art/source/reference/master-asset-sheet.png` |
| `game-screen-reference.png` | `node tools/extract-scene.mjs art/source/reference/game-screen-reference.png` |

Both tools accept any path, so the files can live outside the repository as well.
They are design sources only — nothing here is read at runtime or shipped in a build.
