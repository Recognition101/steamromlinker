# Steam Rom Shortcut Maker

This script will scan ROMs from a given directory or directories and creates a Steam shortcuts file containing a shortcut for each ROM. It will also associate a grid image for each shortcut (grid images are the banners seen in big picture mode). The grid images will be downloaded from Console Grid if you don't already have them.

The script is similar to [Ice](https://scottrice.github.io/Ice/). However, it is simpler (it has limited functionality, but is easier to customize). The entire script is in the `steam-rom-linker.js` file, and there are minimal external dependencies.

## Directory Structure

Here's an example of the directory structure expected by steam-rom-linker:

```
parent/
    ├── config.json
    │
    ├── SNES/
    │   ├── Chrono Trigger.sfc
    │   ├── Super Mario World.sfc
    │   └── images/
    │       ├── Chrono Trigger.png
    |       └── Super Mario World.png
    └── N64/
        ├── Mario Party.z64
        └── images/
```

For this script to work, all ROM files must be in one or more emulator directories who all share the same parent directory.

Each of these emulator directories should have a directory named `images` inside. Inside `images`, there should be one JPG or PNG image per ROM file with a matching filename. If you do not have a matching grid banner image for each game, the script will attempt to download them for you and put them in this directory automatically. In the above example, Mario Party does not have an image, so it will be downloaded.

The config.json file should be placed alongside the emulator directories. It will list all emulator directories (in this example: SNES and N64). See the next section for more information about the config file.


## Config File

The config file is a JSON file that tells the script where to crawl for ROMs and how to generate shortcuts with them. Here's an example of a config file:

```json
{
    "substitutions": {
        "%exe": "C:\\Users\\name\\Games\\Emulators",
        "%rom": "C:\\Users\\name\\Games\\Roms"
    },

    "emulators": [{
        "directory": "N64",
        "console": "N64",
        "dirExe": "%exe\\Mupen64Plus",
        "exe": "%exe\\Mupen64Plus\\run.bat",
        "opts": "\"%rom\\N64\\%r\"",
        "extensions": ["z64", "v64", "n64"],
        "tags": ["roms"]
    }, {
        "directory": "SNES",
        "console": "SNES",
        "dirExe": "%exe\\Snes9x",
        "exe": "%exe\\Snes9x\\snes9x-x64.exe",
        "opts": "-fullscreen \"%rom\\SNES\\%r\"",
        "extensions": ["sfc"],
        "tags": ["roms"]
    }]
}
```

There are two main keys in this JSON object. The first, `substitutions`, is a list of substitutions to make in all strings. In this example, `%exe` will be replaced with `C:\Users\name\Games\Emulators` by the crawler. The substitutions object is optional, but it can be used to avoid having to type the same path over and over for every emulator.

The second object is the `emulators` array, which is an array of `emulator` objects. An `emulator` object has the following properties:

* **directory**: This is the emulator directory name for this emulator.
* **console**: The name of the console this represents. Used for looking up and downloading missing grid banners from Console Grid.
* **dirExe**: The directory the EXE file for this emulator is in.
* **exe**: The path to the EXE file of this emulator.
* **opts**: The options to pass to this emulator. Note that `%r` is used as a placeholder for each ROM file.
* **extensions**: This is an array of all the extensions that ROM files that this emulator use have.
* **tags**: These are the Steam categories that all the ROMs of this emulator will be placed within.

## Usage

To run, make sure NodeJS is installed. Then, clone this repository run the `npm install` command within the cloned directory (to install dependencies). Then, run the script with the following command:

```bash
node steam-rom-linker.js <CONFIG-PATH>
```

Where `<CONFIG-PATH>` is the file path to the config file you are using.

Once run, follow these steps to update Steam:

1. The script will generate a `grid` directory and a `shortcuts.vdf` file in the same directory as the config file.
2. Close steam (if it is open, changes will be overwritten when it closes).
3. Move the directory and VDF file into your `%STEAM_INSTALL%/Steam/userdata/%USER_ID%/config/` directory.
4. Open Steam. The new shortcuts should be there with their corresponding grid images.

**WARNING:** If you overwrite an existing `shortcuts.vdf` file, it will erase all old Steam shortcuts you may have made. This script does not currently support merging VDF files, so it does not support shortcuts other than the ROM shortcuts the script generates.