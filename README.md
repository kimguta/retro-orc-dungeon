# Retro Orc Dungeon

A small static browser prototype for a 90s DOS-style first-person dungeon crawler. It uses HTML, CSS, JavaScript, and Canvas 2D only.

## Play

Open `index.html` in a browser, or serve the folder with any simple static server.

Controls:

- `WASD`: move
- `Left / Right Arrow`: rotate view
- `Mouse`: rotate view after clicking the canvas
- `Left mouse / Space`: normal sword attack
- `Right mouse`: rage special attack when the rage bar is full
- `Enter`: start, advance after stage clear, or restart after game over / clear

## Game

- Room 1: safe start room
- Room 2: regular orcs
- Room 3: orc chief
- The game has 10 stages
- The map layout changes as stages advance
- Regular orcs have 2 HP
- The orc chief has 8 HP
- Only enemies directly in front of the player and at close range are hit by the sword
- Orcs chase the player and deal damage on contact
- Regular orcs can drop health items
- The orc chief drops a relic that advances to the next stage
- The sword upgrades from white to red to gold as stages advance
- A minimap shows walls, the player, enemies, and dropped items
- A rage bar fills from combat and unlocks a stronger right-click special attack
- Stage clear screens summarize completion before the next stage starts

## GitHub Pages

This project is a static site, so it can be deployed with GitHub Pages.

The repository was created as private. If GitHub Pages is not available for a private repository on your account, change the repository visibility to public first.

1. Open the repository on GitHub.
2. Go to `Settings`.
3. Open `Pages`.
4. Under `Build and deployment`, choose `Deploy from a branch`.
5. Select the `main` branch and the root folder `/`.
6. Save the settings.

After GitHub finishes publishing, the game will be available at the Pages URL shown in that settings screen.
