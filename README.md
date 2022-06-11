# MMOMZ-PKD-ABS (WIP)
Backend support for real-time Action Battle System (MMORPG Maker MZ)

Please consider contributing to this project by submitting your pull requests. 

**Join us on Discord : https://discord.gg/GVqyAwp**

## Important
This code is currently in testing on [EtheRPG Online/Naire Online](https://naire.online/) and is still under development. 

:warning: You Have to support PKD patreon (see below) in order to access to the RPG Maker `Alpha ABSZ` plugin. 

An official RPG Maker MZ licence is also required. 

## Requirements
1. [MMORPG Maker MZ](https://github.com/Andaroth/MMORPGMaker-MZ) code from the `master` branch
2. The whole ABSZ engine & requirements from [Phoenix Kage Desu's patreon](https://www.patreon.com/KageDesu)
3. The `mathjs` Node module

## Installation
1. Download `Alpha ABSZ` plugin from Phoenix Kage Desu's patreon and install it in your project

2. In a terminal, in your project's `server` folder, run this command: `npm install mathjs`

3. Copy the files from our `MMOMZ-PKD-ABS/server/core` to your MMORPG Maker MZ project `server/core` folder, override the old ones

4. Edit your MMORPG Maker MZ's `mmo.js` find this line: `gameworld: require("./core/gameworld")` and replace it with: 
```js
    gameworld: require("./core/gameworld"),
    wabs: require("./core/wabs")
```

5. In the same `mmo.js` file, find and replace `MMO_Core.gameworld.initialize();` with: 
```js
MMO_Core["gameworld"].initialize(() => MMO_Core["wabs"].initialize());
```

6. Edit the `Alpha ABSZ` plugin file and add this code after the `//TODO: perform skill` comment: 
```js
WABS_Sockets.emitAction({ skillId, target: {} });
```

7. Copy the files from our `MMOMZ-PKD-ABS/js/plugins` to your project `js/plugins` folder (override existing ones) and activate them in the Plugins Manager

8. You can now use MMORPG Maker to create worlds with real-time fights! 

## Instructions
*coming soon! Please read the comments in our code & the ABS documentation*

---

**Join us on Discord : https://discord.gg/GVqyAwp**
