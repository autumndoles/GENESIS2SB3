const romInput = document.getElementById("romInput");
const dropZone = document.getElementById("dropZone");
const romInfo = document.getElementById("romInfo");
const romName = document.getElementById("romName");
const romSize = document.getElementById("romSize");
const romStatus = document.getElementById("romStatus");
const removeRom = document.getElementById("removeRom");

const compileButton = document.getElementById("compileButton");
const progressContainer = document.getElementById("progressContainer");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const progressPercent = document.getElementById("progressPercent");

const status = document.getElementById("status");
const result = document.getElementById("result");
const resultText = document.getElementById("resultText");
const downloadButton = document.getElementById("downloadButton");

const includeRom = document.getElementById("includeRom");
const generateEmulator = document.getElementById("generateEmulator");
const optimize = document.getElementById("optimize");

let currentROM = null;
let currentROMData = null;
let generatedSB3 = null;

/* =========================================================
BASIC UTILITIES
========================================================= */

function formatBytes(bytes) {
if (bytes < 1024) {
return `${bytes} B`;
}

```
if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
}

return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
```

}

function setStatus(message, type = "") {
status.textContent = message;
status.className = "status";

```
if (type) {
    status.classList.add(type);
}
```

}

function setProgress(percent, message) {
percent = Math.max(0, Math.min(100, percent));

```
progressBar.style.width = `${percent}%`;
progressPercent.textContent = `${Math.round(percent)}%`;
progressText.textContent = message;
```

}

function sleep(ms) {
return new Promise(resolve => setTimeout(resolve, ms));
}

/* =========================================================
ROM LOADING
========================================================= */

romInput.addEventListener("change", event => {
const file = event.target.files[0];

```
if (file) {
    loadROM(file);
}
```

});

dropZone.addEventListener("dragover", event => {
event.preventDefault();
dropZone.classList.add("dragging");
});

dropZone.addEventListener("dragleave", () => {
dropZone.classList.remove("dragging");
});

dropZone.addEventListener("drop", event => {
event.preventDefault();

```
dropZone.classList.remove("dragging");

const file = event.dataTransfer.files[0];

if (!file) {
    return;
}

loadROM(file);
```

});

async function loadROM(file) {
resetCompilation();

```
const extension = file.name
    .split(".")
    .pop()
    .toLowerCase();

const validExtensions = [
    "bin",
    "gen",
    "md",
    "smd"
];

if (!validExtensions.includes(extension)) {
    setStatus(
        "That doesn't look like a supported Genesis ROM file.",
        "error"
    );

    return;
}

if (file.size === 0) {
    setStatus(
        "The selected ROM is empty.",
        "error"
    );

    return;
}

try {
    const buffer = await file.arrayBuffer();

    let data = new Uint8Array(buffer);

    /*
     * SMD ROMs may contain a 512-byte header.
     * Remove it before parsing the actual Genesis ROM.
     */
    if (
        extension === "smd" &&
        data.length > 512 &&
        (data.length - 512) % 16384 === 0
    ) {
        data = data.slice(512);
    }

    currentROM = file;
    currentROMData = data;

    displayROMInfo();

    const validation = validateGenesisROM(data);

    if (!validation.valid) {
        setStatus(
            validation.message,
            "warning"
        );

        return;
    }

    setStatus(
        `ROM loaded successfully. ${validation.title}`,
        "success"
    );

    compileButton.disabled = false;

} catch (error) {
    console.error(error);

    setStatus(
        "Could not read the ROM.",
        "error"
    );
}
```

}

function displayROMInfo() {
romInfo.classList.remove("hidden");

```
romName.textContent = currentROM.name;
romSize.textContent = formatBytes(currentROMData.length);

romStatus.textContent = "ROM loaded";

dropZone.classList.add("has-rom");
```

}

/* =========================================================
GENESIS ROM PARSER
========================================================= */

function readASCII(data, start, length) {
let result = "";

```
for (let i = 0; i < length; i++) {
    const value = data[start + i];

    if (
        value >= 32 &&
        value <= 126
    ) {
        result += String.fromCharCode(value);
    } else {
        result += " ";
    }
}

return result.trim();
```

}

function readUint32BE(data, offset) {
return (
((data[offset] << 24) >>> 0) |
(data[offset + 1] << 16) |
(data[offset + 2] << 8) |
data[offset + 3]
) >>> 0;
}

function readUint16BE(data, offset) {
return (
(data[offset] << 8) |
data[offset + 1]
) >>> 0;
}

function validateGenesisROM(data) {
if (data.length < 0x200) {
return {
valid: false,
message: "The file is too small to be a normal Genesis ROM."
};
}

```
/*
 * Genesis ROMs normally contain "SEGA" around offset 0x100.
 */
const signature = readASCII(
    data,
    0x100,
    4
);

if (signature !== "SEGA") {
    return {
        valid: false,
        message:
            "No standard SEGA header was detected. The file may still be usable, but automatic detection failed."
    };
}

const system = readASCII(
    data,
    0x100,
    16
);

const domesticTitle = readASCII(
    data,
    0x120,
    48
);

const internationalTitle = readASCII(
    data,
    0x150,
    48
);

const version = readASCII(
    data,
    0x182,
    14
);

return {
    valid: true,
    title:
        internationalTitle ||
        domesticTitle ||
        "Genesis ROM",
    system,
    domesticTitle,
    internationalTitle,
    version
};
```

}

function parseGenesisROM(data) {
const header = {
console: readASCII(data, 0x100, 16),

```
    domesticTitle: readASCII(
        data,
        0x120,
        48
    ),

    internationalTitle: readASCII(
        data,
        0x150,
        48
    ),

    serial: readASCII(
        data,
        0x180,
        14
    ),

    version: readASCII(
        data,
        0x18E,
        2
    ),

    checksum: readUint16BE(
        data,
        0x18E
    ),

    region: readASCII(
        data,
        0x1F0,
        16
    )
};

/*
 * The first two longwords are the initial
 * stack pointer and reset vector.
 */

const initialStackPointer =
    readUint32BE(data, 0);

const resetVector =
    readUint32BE(data, 4);

return {
    header,

    initialStackPointer,

    resetVector,

    romSize: data.length,

    romEnd:
        data.length - 1
};
```

}

/* =========================================================
68000 MEMORY
========================================================= */

class Memory68000 {
constructor(rom) {
this.rom = rom;

```
    /*
     * Main Genesis RAM.
     */
    this.ram = new Uint8Array(64 * 1024);

    /*
     * Scratch-side representation of
     * Genesis VRAM and CRAM.
     */
    this.vram = new Uint8Array(64 * 1024);
    this.cram = new Uint8Array(128);
}

read8(address) {
    address >>>= 0;

    /*
     * ROM:
     * 0x000000 - 0x3FFFFF
     */
    if (address < this.rom.length) {
        return this.rom[address] || 0;
    }

    /*
     * Main RAM:
     * 0xFF0000 - 0xFFFFFF
     */
    if (address >= 0xFF0000) {
        return this.ram[address & 0xFFFF];
    }

    return 0;
}

read16(address) {
    return (
        (this.read8(address) << 8) |
        this.read8(address + 1)
    ) >>> 0;
}

read32(address) {
    return (
        (this.read16(address) * 0x10000) +
        this.read16(address + 2)
    ) >>> 0;
}

write8(address, value) {
    address >>>= 0;
    value &= 0xFF;

    if (address >= 0xFF0000) {
        this.ram[address & 0xFFFF] = value;
    }
}

write16(address, value) {
    this.write8(
        address,
        value >> 8
    );

    this.write8(
        address + 1,
        value
    );
}

write32(address, value) {
    this.write16(
        address,
        Math.floor(value / 0x10000)
    );

    this.write16(
        address + 2,
        value & 0xFFFF
    );
}
```

}

/* =========================================================
BASIC MOTOROLA 68000 CPU
========================================================= */

class MC68000 {
constructor(memory) {
this.memory = memory;

```
    this.d = new Uint32Array(8);
    this.a = new Uint32Array(8);

    this.pc = 0;
    this.sr = 0x2700;

    this.running = false;
    this.cycles = 0;
}

reset() {
    this.a[7] =
        this.memory.read32(0);

    this.pc =
        this.memory.read32(4);

    this.sr = 0x2700;

    this.running = true;
    this.cycles = 0;
}

fetch16() {
    const value =
        this.memory.read16(this.pc);

    this.pc =
        (this.pc + 2) >>> 0;

    return value;
}

fetch32() {
    const value =
        this.memory.read32(this.pc);

    this.pc =
        (this.pc + 4) >>> 0;

    return value;
}

step() {
    if (!this.running) {
        return;
    }

    const opcode = this.fetch16();

    this.execute(opcode);

    this.cycles++;
}

execute(opcode) {
    /*
     * This is the foundation of the 68000
     * instruction decoder.
     *
     * More instructions will be added here.
     */

    switch (opcode) {

        /*
         * NOP
         */
        case 0x4E71:
            break;

        /*
         * RTS
         */
        case 0x4E75:
            this.pc =
                this.memory.read32(this.a[7]);

            this.a[7] =
                (this.a[7] + 4) >>> 0;

            break;

        /*
         * RESET
         */
        case 0x4E70:
            break;

        /*
         * STOP
         */
        case 0x4E72:
            this.running = false;
            break;

        default:
            /*
             * Unknown instructions currently
             * become a no-op so that the compiler
             * can continue analyzing a ROM.
             */
            break;
    }
}
```

}

/* =========================================================
GENESIS VDP
========================================================= */

class GenesisVDP {
constructor() {
this.vram = new Uint8Array(64 * 1024);
this.cram = new Uint16Array(64);

```
    this.registers =
        new Uint16Array(24);

    this.status = 0x3400;

    this.displayWidth = 320;
    this.displayHeight = 224;
}

reset() {
    this.vram.fill(0);
    this.cram.fill(0);
    this.registers.fill(0);

    this.status = 0x3400;
}

writeVRAM(address, value) {
    this.vram[
        address & 0xFFFF
    ] = value & 0xFF;
}

writeCRAM(index, value) {
    this.cram[
        index & 63
    ] = value & 0xFFFF;
}
```

}

/* =========================================================
GENESIS CONTROLLER
========================================================= */

class GenesisController {
constructor() {
this.buttons = {
up: false,
down: false,
left: false,
right: false,
a: false,
b: false,
c: false,
start: false
};
}

```
press(button) {
    if (button in this.buttons) {
        this.buttons[button] = true;
    }
}

release(button) {
    if (button in this.buttons) {
        this.buttons[button] = false;
    }
}
```

}

/* =========================================================
SCRATCH PROJECT GENERATOR
========================================================= */

function generateScratchProject(romData, options) {
const project = {
targets: [],
monitors: [],
extensions: [],
meta: {
semver: "3.0.0",
vm: "0.2.0",
agent: "Genesis2SB3"
}
};

```
const stage = createScratchStage(
    romData,
    options
);

project.targets.push(stage);

return project;
```

}

function createScratchStage(romData, options) {
const variables = {};

```
variables["Genesis PC"] = [
    "Genesis PC",
    0
];

variables["Genesis Cycles"] = [
    "Genesis Cycles",
    0
];

variables["Genesis Running"] = [
    "Genesis Running",
    0
];

variables["Genesis ROM Size"] = [
    "Genesis ROM Size",
    romData.length
];

const stage = {
    isStage: true,

    name: "Genesis Emulator",

    variables,

    lists: {},

    broadcasts: {},

    blocks: {},

    comments: {},

    currentCostume: 0,

    costumes: [],

    sounds: [],

    volume: 100,

    layerOrder: 0,

    tempo: 60
};

/*
 * A simple placeholder costume is generated
 * by the real SB3 builder later.
 */

if (options.generateEmulator) {
    addEmulatorBlocks(stage);
}

return stage;
```

}

function addEmulatorBlocks(stage) {
const greenFlag =
"genesis_green_flag";

```
const forever =
    "genesis_forever";

stage.blocks[greenFlag] = {
    opcode: "event_whenflagclicked",

    next: forever,

    parent: null,

    inputs: {},

    fields: {},

    shadow: false,

    topLevel: true,

    x: 100,

    y: 100
};

stage.blocks[forever] = {
    opcode: "control_forever",

    next: null,

    parent: greenFlag,

    inputs: {
        SUBSTACK: [
            2,
            "genesis_step"
        ]
    },

    fields: {},

    shadow: false,

    topLevel: false
};

stage.blocks["genesis_step"] = {
    opcode: "data_changevariableby",

    next: null,

    parent: forever,

    inputs: {
        VALUE: [
            1,
            "1"
        ]
    },

    fields: {
        VARIABLE: [
            "Genesis Cycles",
            "Genesis Cycles"
        ]
    },

    shadow: false,

    topLevel: false
};
```

}

/* =========================================================
JSON → SB3 ZIP
========================================================= */

/*

* SB3 files are ZIP archives.
*
* To keep Genesis2SB3 lightweight, this project uses
* a tiny built-in ZIP writer rather than requiring a
* large framework.
*
* The implementation below creates STORE-only ZIP
* archives. Scratch accepts uncompressed project.json,
* and this also keeps the compiler dependency-free.
  */

function crc32(data) {
let crc = 0xFFFFFFFF;

```
for (let i = 0; i < data.length; i++) {
    crc ^= data[i];

    for (let j = 0; j < 8; j++) {
        crc =
            (crc >>> 1) ^
            (
                0xEDB88320 &
                -(crc & 1)
            );
    }
}

return (
    (crc ^ 0xFFFFFFFF) >>> 0
);
```

}

function uint16(value) {
return new Uint8Array([
value & 255,
(value >>> 8) & 255
]);
}

function uint32(value) {
return new Uint8Array([
value & 255,
(value >>> 8) & 255,
(value >>> 16) & 255,
(value >>> 24) & 255
]);
}

function concatBytes(...arrays) {
let total = 0;

```
for (const array of arrays) {
    total += array.length;
}

const result =
    new Uint8Array(total);

let offset = 0;

for (const array of arrays) {
    result.set(array, offset);
    offset += array.length;
}

return result;
```

}

function createZip(files) {
const localParts = [];
const centralParts = [];

```
let offset = 0;

for (const file of files) {
    const name =
        new TextEncoder().encode(file.name);

    const data = file.data;

    const checksum = crc32(data);

    const localHeader = concatBytes(
        new Uint8Array([
            0x50, 0x4B, 0x03, 0x04
        ]),

        uint16(20),
        uint16(0),
        uint16(0),

        uint16(0),
        uint16(0),

        uint32(checksum),
        uint32(data.length),
        uint32(data.length),

        uint16(name.length),
        uint16(0),

        name
    );

    localParts.push(
        localHeader,
        data
    );

    const centralHeader = concatBytes(
        new Uint8Array([
            0x50, 0x4B, 0x01, 0x02
        ]),

        uint16(20),
        uint16(20),
        uint16(0),
        uint16(0),

        uint16(0),
        uint16(0),

        uint32(checksum),
        uint32(data.length),
        uint32(data.length),

        uint16(name.length),
        uint16(0),
        uint16(0),
        uint16(0),
        uint16(0),

        uint32(0),
        uint32(offset),

        name
    );

    centralParts.push(
        centralHeader
    );

    offset +=
        localHeader.length +
        data.length;
}

const localData =
    concatBytes(...localParts);

const centralData =
    concatBytes(...centralParts);

const endRecord = concatBytes(
    new Uint8Array([
        0x50, 0x4B, 0x05, 0x06
    ]),

    uint16(0),
    uint16(0),

    uint16(files.length),
    uint16(files.length),

    uint32(centralData.length),
    uint32(localData.length),

    uint16(0)
);

return concatBytes(
    localData,
    centralData,
    endRecord
);
```

}

/* =========================================================
SB3 BUILD
========================================================= */

async function buildSB3() {
if (!currentROMData) {
throw new Error(
"No ROM has been selected."
);
}

```
const options = {
    includeRom: includeRom.checked,
    generateEmulator:
        generateEmulator.checked,
    optimize: optimize.checked
};

setProgress(
    5,
    "Parsing Genesis ROM..."
);

await sleep(20);

const parsed =
    parseGenesisROM(
        currentROMData
    );

setProgress(
    15,
    "Initializing 68000 CPU..."
);

await sleep(20);

const memory =
    new Memory68000(
        currentROMData
    );

const cpu =
    new MC68000(memory);

cpu.reset();

setProgress(
    25,
    "Initializing Genesis VDP..."
);

await sleep(20);

const vdp =
    new GenesisVDP();

vdp.reset();

setProgress(
    35,
    "Generating Scratch runtime..."
);

await sleep(20);

const project =
    generateScratchProject(
        currentROMData,
        options
    );

/*
 * Store some useful ROM metadata.
 */
project.genesis2sb3 = {
    console: parsed.header.console,
    title:
        parsed.header.internationalTitle ||
        parsed.header.domesticTitle,

    serial: parsed.header.serial,

    version: parsed.header.version,

    region: parsed.header.region,

    romSize: parsed.romSize,

    initialStackPointer:
        parsed.initialStackPointer,

    resetVector:
        parsed.resetVector,

    compilerVersion: "0.1.0"
};

setProgress(
    50,
    "Preparing project.json..."
);

await sleep(20);

const projectJSON =
    JSON.stringify(
        project
    );

const projectBytes =
    new TextEncoder().encode(
        projectJSON
    );

const files = [
    {
        name: "project.json",
        data: projectBytes
    }
];

/*
 * The actual ROM embedding system will be expanded
 * as the Scratch Genesis runtime is implemented.
 */
if (options.includeRom) {
    files.push({
        name: "genesis.rom",
        data: currentROMData
    });
}

setProgress(
    75,
    "Building SB3 archive..."
);

await sleep(20);

const zip =
    createZip(files);

setProgress(
    95,
    "Finalizing SB3..."
);

await sleep(20);

generatedSB3 =
    new Blob(
        [zip],
        {
            type:
                "application/zip"
        }
    );

setProgress(
    100,
    "Compilation complete."
);

return {
    parsed,
    size: zip.length
};
```

}

/* =========================================================
COMPILE BUTTON
========================================================= */

compileButton.addEventListener(
"click",
async () => {

```
    if (!currentROMData) {
        setStatus(
            "Select a ROM first.",
            "error"
        );

        return;
    }

    compileButton.disabled = true;

    result.classList.add("hidden");

    progressContainer.classList.remove(
        "hidden"
    );

    setStatus(
        "Starting compiler..."
    );

    try {
        const output =
            await buildSB3();

        const title =
            output.parsed.header
                .internationalTitle ||
            output.parsed.header
                .domesticTitle ||
            currentROM.name;

        resultText.textContent =
            `${title} has been compiled into a Scratch project.`;

        result.classList.remove(
            "hidden"
        );

        setStatus(
            `Successfully generated ${formatBytes(output.size)} of SB3 data.`,
            "success"
        );

    } catch (error) {
        console.error(error);

        setStatus(
            `Compilation failed: ${error.message}`,
            "error"
        );

        progressContainer.classList.add(
            "hidden"
        );
    }

    compileButton.disabled = false;
}
```

);

/* =========================================================
DOWNLOAD
========================================================= */

downloadButton.addEventListener(
"click",
() => {

```
    if (!generatedSB3) {
        return;
    }

    let filename =
        currentROM
            ? currentROM.name
            : "genesis-game";

    filename =
        filename.replace(
            /\.[^/.]+$/,
            ""
        );

    filename += ".sb3";

    const url =
        URL.createObjectURL(
            generatedSB3
        );

    const link =
        document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);

    link.click();

    link.remove();

    setTimeout(
        () => URL.revokeObjectURL(url),
        1000
    );
}
```

);

/* =========================================================
REMOVE ROM
========================================================= */

removeRom.addEventListener(
"click",
() => {
resetROM();
}
);

function resetROM() {
currentROM = null;
currentROMData = null;
generatedSB3 = null;

```
romInput.value = "";

romInfo.classList.add(
    "hidden"
);

result.classList.add(
    "hidden"
);

progressContainer.classList.add(
    "hidden"
);

dropZone.classList.remove(
    "has-rom"
);

romStatus.textContent =
    "No ROM selected";

compileButton.disabled = true;

setStatus(
    "Select a Genesis ROM to begin."
);
```

}

function resetCompilation() {
generatedSB3 = null;

```
result.classList.add(
    "hidden"
);

progressContainer.classList.add(
    "hidden"
);
```

}

/* =========================================================
KEYBOARD SHORTCUT
========================================================= */

document.addEventListener(
"keydown",
event => {

```
    /*
     * Ctrl + O opens the ROM picker.
     */
    if (
        event.ctrlKey &&
        event.key.toLowerCase() === "o"
    ) {
        event.preventDefault();

        romInput.click();
    }

    /*
     * Ctrl + Enter compiles.
     */
    if (
        event.ctrlKey &&
        event.key === "Enter" &&
        !compileButton.disabled
    ) {
        event.preventDefault();

        compileButton.click();
    }
}
```

);

/* =========================================================
INITIALIZATION
========================================================= */

setStatus(
"Select a Genesis ROM to begin."
);

console.log(
"Genesis2SB3 initialized."
);

console.log(
"Genesis compiler version: 0.1.0"
);
