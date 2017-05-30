/* eslint-env node */
/* eslint no-console: 0 */
/* global Promise */
/**
 * @typedef {Object} Emulator
 * @prop {string} directory
 * @prop {string} console
 * @prop {string} exe
 * @prop {string} opts
 * @prop {string} dirExe
 * @prop {Array<string>} extensions
 * @prop {Array<string>} tags
 * 
 * @typedef {Object} SteamConfig
 * @prop {string} romRoot
 * @prop {Object} substitutions
 * @prop {Array<Emulator>} emulators
 * 
 * @typedef {Object} SteamShortcut
 * @prop {string} AppName
 * @prop {string} exe
 * @prop {string} StartDir
 * @prop {boolean} IsHidden
 * @prop {boolean} AllowDesktopConfig
 * @prop {boolean} OpenVR
 * @prop {Array<string>} tags
 * @prop {string} LaunchOptions
 */

const steam = require('steam-shortcut-editor');
const fetch = require('node-fetch');
const crc = require('crc');
const BigNumber = require('bn.js');
const bn = x => new BigNumber(x);

const fs = require('fs');
const path = require('path');
const os = require('os');

if (process.argv.length !== 3) {
    console.log('USAGE: node steam-rom-linker.js <config.json>');
}

const configFn = process.argv[2].replace(/^~/, os.homedir());
const configDir = path.dirname(configFn);
/** @type {SteamConfig} */
const config = JSON.parse(fs.readFileSync(configFn));

/**
 * Given a rom file path, returns the human-readable ROM name (strips parens).
 * @param {string} romFn the filename of the current ROM (or the full path)
 * @return {string} the rom name, based on the filename
 */
const getRomName = romFn => (
    path.basename(romFn, path.extname(romFn))
        .replace(/\([^(]*\)/g, '')
        .replace(/\[[^[]*\]/g, ''))
        .trim();

/**
 * Given a string, make substitutions based on the config object.
 * @param {string} str string to make substitutions in
 * @param {string} romFn the filename of the current ROM
 * @return {string} the string with substitutions made
 */
const substitute = (str, romFn) => (
    Object.keys(config.substitutions).reduce((cmd, sub) =>
        cmd.replace(new RegExp(sub, 'g'), config.substitutions[sub]),
    str)
    .replace(/%r/g, romFn));

/**
 * Given a ROM path, gets the file path to the corresponding banner image.
 * @param {string} romPath the full path of the current ROM being processed
 * @return {string|null} the path to the image file for this ROM
 *  (or null if none currently exists)
 */
const getImagePath = romPath => {
    const dir = path.dirname(romPath);
    const rom = path.basename(romPath, path.extname(romPath));
    return [ 'png', 'jpg', 'jpeg' ]
        .map(ext => path.join(dir, 'images', rom + '.' + ext))
        .find(fn => fs.existsSync(fn)) || null;
};

/**
 * Given an emulator and a ROM file path, get a file path to a banner image. If
 * no image exists locally, it will attempt to download one from the internet.
 * @param {Emulator} emulator the emulator this ROM runs with
 * @param {string} romPath the full path to this ROM
 * @return {Promise} a promise that resolves to a string file path of the
 *  banner image, or null if a banner image could not be found
 */
const loadImage = (emulator, romPath) => {
    const existingImgFn = getImagePath(romPath);
    const apiUrl = 'http://consolegrid.com/api/top_picture';
    const dir = path.join(configDir, emulator.directory, 'images');
    const romNoExt = path.basename(romPath, path.extname(romPath));
    const encSys = encodeURIComponent(emulator.console);
    const encRom = encodeURIComponent(getRomName(romPath));

    if (existingImgFn) {
        return Promise.resolve(existingImgFn);
    }

    try { fs.mkdirSync(dir); } catch(e) {}

    console.log('Downloading image: ' + emulator.console + ', ' + romNoExt);
    return fetch(`${apiUrl}?console=${encSys}&game=${encRom}`)
    .then(response => response.text())
    .then(url => url && url.startsWith('http') ? fetch(url) : null)
    .then(res => res
        ? new Promise(yes => {
            const imgFn = path.join(dir, romNoExt + path.extname(res.url));
            const dest = fs.createWriteStream(imgFn);
            res.body.pipe(dest).on('end', () => yes(imgFn));
        })
        : null
    );
};

/**
 * Copies an image from a given path to the steam-compatible grid filename.
 * @param {string} fromPath the path of the image we're copying
 * @param {SteamShortcut} shortcut the steam shortcut this grid image is for
 * @return {Promise} a promise that resolves when the image is copied
 */
const copyImage = (fromFn, shortcut) => {
    const gridFn = path.join(configDir, 'grid');
    const checksum = crc.crc32(shortcut.exe + shortcut.AppName);
    const id = bn(checksum).or(bn(0x80000000)).shln(32).or(bn(0x02000000));

    const toFn = path.join(gridFn, id.toString() + path.extname(fromFn));

    try { fs.mkdirSync(gridFn); } catch(e) {}

    return new Promise(yes => {
        fs.createReadStream(fromFn)
        .pipe(fs.createWriteStream(toFn))
        .on('finish', yes);
    });
};

/** @type {Array<SteamShortcut>} */
const shortcuts = [];

/** @type {Array<Promise>} */
const images = [];

config.emulators.forEach(emulator => {
    const emuDir = path.join(configDir, emulator.directory);
    fs.readdirSync(emuDir).forEach(romFn => {
        const romPath = path.join(emuDir, romFn);
        const romExt  = path.extname(romFn).replace('.', '');
        if (emulator.extensions.includes(romExt)) {
            const shortcut = {
                AppName: getRomName(romFn),
                exe: substitute(emulator.exe, romFn),
                StartDir: substitute(emulator.dirExe, romFn),
                IsHidden: false,
                AllowDesktopConfig: true,
                OpenVR: false,
                tags: emulator.tags,
                LaunchOptions: substitute(emulator.opts, romFn),
            };

            shortcuts.push(shortcut);

            images.push(
                loadImage(emulator, romPath)
                .then(imageFn => {
                    if (imageFn) {
                        return copyImage(imageFn, shortcut);
                    } else {
                        console.log('No image found for: ' +
                            emulator.console + ' / ' +
                            getRomName(romFn)
                        );
                        return null;
                    }
                })
            );
        }
    });
});

const shortcutFn = path.join(configDir, 'shortcuts.vdf');
steam.writeFile(shortcutFn, { shortcuts: shortcuts }, () => {
    console.log('Shortcut VDF written.');
});

Promise.all(images).then(
    () => { console.log('Grid images loaded and copied.'); },
    (e) => { console.error(e); }
);