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

let currentROM = null;
let currentROMData = null;
let currentROMInfo = null;
let generatedSB3 = null;

/* =========================================================
CONSTANTS
========================================================= */

const VERSION = "0.1.0";

const SUPPORTED_EXTENSIONS = [
"bin",
"gen",
"md",
"smd"
];

/* =========================================================
GENERAL UTILITIES
========================================================= */

function formatBytes(bytes) {
if (bytes < 1024) {
return `${bytes} B`;
}

```
if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
}

return `${(bytes / 1048576).toFixed(2)} MB`;
```

}

function formatHex(value, digits = 8) {
return (
"0x" +
(value >>> 0)
.toString(16)
.toUpperCase()
.padStart(digits, "0")
);
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
percent = Math.max(
0,
Math.min(100, percent)
);

```
progressBar.style.width =
    `${percent}%`;

progressPercent.textContent =
    `${Math.round(percent)}%`;

progressText.textContent =
    message;
```

}

function sleep(ms) {
return new Promise(resolve => {
setTimeout(resolve, ms);
});
}

function concatBytes(...arrays) {
let length = 0;

```
for (const array of arrays) {
    length += array.length;
}

const output =
    new Uint8Array(length);

let offset = 0;

for (const array of arrays) {
    output.set(array, offset);
    offset += array.length;
}

return output;
```

}

function uint16LE(value) {
return new Uint8Array([
value & 0xFF,
(value >>> 8) & 0xFF
]);
}

function uint32LE(value) {
return new Uint8Array([
value & 0xFF,
(value >>> 8) & 0xFF,
(value >>> 16) & 0xFF,
(value >>> 24) & 0xFF
]);
}

function read16BE(data, offset) {
if (
offset < 0 ||
offset + 1 >= data.length
) {
return 0;
}

```
return (
    (data[offset] << 8) |
    data[offset + 1]
) >>> 0;
```

}

function read32BE(data, offset) {
if (
offset < 0 ||
offset + 3 >= data.length
) {
return 0;
}

```
return (
    data[offset] * 0x1000000 +
    data[offset + 1] * 0x10000 +
    data[offset + 2] * 0x100 +
    data[offset + 3]
) >>> 0;
```

}

function readASCII(data, offset, length) {
let text = "";

```
for (
    let i = 0;
    i < length &&
    offset + i < data.length;
    i++
) {
    const value =
        data[offset + i];

    if (
        value >= 32 &&
        value <= 126
    ) {
        text +=
            String.fromCharCode(value);
    } else {
        text += " ";
    }
}

return text
    .replace(/\0/g, "")
    .replace(/\s+/g, " ")
    .trim();
```

}

/* =========================================================
ROM INPUT
========================================================= */

romInput.addEventListener(
"change",
event => {
const file =
event.target.files[0];

```
    if (file) {
        loadROM(file);
    }
}
```

);

dropZone.addEventListener(
"dragover",
event => {
event.preventDefault();

```
    dropZone.classList.add(
        "dragging"
    );
}
```

);

dropZone.addEventListener(
"dragleave",
() => {
dropZone.classList.remove(
"dragging"
);
}
);

dropZone.addEventListener(
"drop",
event => {
event.preventDefault();

```
    dropZone.classList.remove(
        "dragging"
    );

    const file =
        event.dataTransfer.files[0];

    if (file) {
        loadROM(file);
    }
}
```

);

async function loadROM(file) {
resetCompilation();

```
const extension =
    file.name
        .split(".")
        .pop()
        .toLowerCase();

if (
    !SUPPORTED_EXTENSIONS
        .includes(extension)
) {
    setStatus(
        "Unsupported ROM file type.",
        "error"
    );

    return;
}

if (file.size === 0) {
    setStatus(
        "The selected file is empty.",
        "error"
    );

    return;
}

setStatus(
    "Reading ROM..."
);

try {
    let data =
        new Uint8Array(
            await file.arrayBuffer()
        );

    let smdDetected = false;

    if (
        extension === "smd" &&
        looksLikeSMD(data)
    ) {
        data =
            deinterleaveSMD(data);

        smdDetected = true;
    }

    /*
     * Some files have a 512-byte SMD header
     * even when they don't use the .smd extension.
     */
    if (
        extension !== "smd" &&
        looksLikeSMD(data)
    ) {
        data =
            deinterleaveSMD(data);

        smdDetected = true;
    }

    currentROM = file;
    currentROMData = data;

    currentROMInfo =
        parseGenesisROM(data);

    displayROMInfo();

    if (
        !currentROMInfo.headerFound
    ) {
        setStatus(
            "ROM loaded, but no standard SEGA header was found.",
            "warning"
        );

        compileButton.disabled =
            false;

        return;
    }

    const title =
        currentROMInfo.title ||
        "Untitled Genesis ROM";

    const suffix =
        smdDetected
            ? " SMD format detected and converted."
            : "";

    setStatus(
        `${title} loaded successfully.${suffix}`,
        "success"
    );

    compileButton.disabled =
        false;

} catch (error) {
    console.error(error);

    currentROM = null;
    currentROMData = null;
    currentROMInfo = null;

    setStatus(
        `Could not read ROM: ${error.message}`,
        "error"
    );
}
```

}

/* =========================================================
SMD SUPPORT
========================================================= */

function looksLikeSMD(data) {
if (data.length < 512 + 16384) {
return false;
}

```
if (
    (data.length - 512) %
    16384 !== 0
) {
    return false;
}

/*
 * Most SMD headers begin with a small
 * mapper/header area. This isn't enough
 * to prove the format, so also inspect
 * the first block's interleaving pattern.
 */
const body =
    data.subarray(512);

const firstHalf =
    body.subarray(0, 8192);

const secondHalf =
    body.subarray(8192, 16384);

let nonZeroFirst = 0;
let nonZeroSecond = 0;

for (
    let i = 0;
    i < 8192;
    i++
) {
    if (firstHalf[i] !== 0) {
        nonZeroFirst++;
    }

    if (secondHalf[i] !== 0) {
        nonZeroSecond++;
    }
}

return (
    nonZeroFirst > 100 &&
    nonZeroSecond > 100
);
```

}

function deinterleaveSMD(data) {
const header =
data.slice(0, 512);

```
const body =
    data.slice(512);

const output =
    new Uint8Array(
        body.length
    );

for (
    let blockStart = 0;
    blockStart < body.length;
    blockStart += 16384
) {
    const blockEnd =
        Math.min(
            blockStart + 16384,
            body.length
        );

    const blockSize =
        blockEnd - blockStart;

    if (blockSize < 2) {
        output.set(
            body.subarray(
                blockStart,
                blockEnd
            ),
            blockStart
        );

        continue;
    }

    const half =
        Math.floor(
            blockSize / 2
        );

    /*
     * SMD stores odd bytes in one half
     * and even bytes in the other.
     */
    for (
        let i = 0;
        i < half;
        i++
    ) {
        output[
            blockStart + i * 2
        ] =
            body[
                blockStart +
                half +
                i
            ];

        output[
            blockStart + i * 2 + 1
        ] =
            body[
                blockStart + i
            ];
    }

    /*
     * Handle an odd trailing byte.
     */
    if (
        blockSize % 2 !== 0
    ) {
        output[
            blockEnd - 1
        ] =
            body[
                blockEnd - 1
            ];
    }
}

return output;
```

}

/* =========================================================
GENESIS HEADER PARSER
========================================================= */

function parseGenesisROM(data) {
const headerOffset =
findGenesisHeader(data);

```
if (headerOffset < 0) {
    return {
        headerFound: false,

        title: "",

        console: "",

        serial: "",

        version: "",

        region: "",

        checksum: 0,

        romStart: 0,

        romEnd: data.length - 1,

        ramStart: 0,

        ramEnd: 0,

        initialSP:
            read32BE(data, 0),

        resetVector:
            read32BE(data, 4),

        vectors:
            readVectorTable(data)
    };
}

const h =
    headerOffset;

const domesticTitle =
    readASCII(
        data,
        h + 0x20,
        48
    );

const internationalTitle =
    readASCII(
        data,
        h + 0x50,
        48
    );

const title =
    internationalTitle ||
    domesticTitle;

const info = {
    headerFound: true,

    headerOffset: h,

    console:
        readASCII(
            data,
            h,
            16
        ),

    domesticTitle,

    internationalTitle,

    title,

    serial:
        readASCII(
            data,
            h + 0x60,
            14
        ),

    version:
        readASCII(
            data,
            h + 0x6E,
            2
        ),

    checksum:
        read16BE(
            data,
            h + 0x6E
        ),

    romStart:
        read32BE(
            data,
            h + 0x80
        ),

    romEnd:
        read32BE(
            data,
            h + 0x84
        ),

    ramStart:
        read32BE(
            data,
            h + 0x88
        ),

    ramEnd:
        read32BE(
            data,
            h + 0x8C
        ),

    region:
        readASCII(
            data,
            h + 0xF0,
            16
        ),

    initialSP:
        read32BE(data, 0),

    resetVector:
        read32BE(data, 4),

    vectors:
        readVectorTable(data)
};

info.calculatedChecksum =
    calculateGenesisChecksum(
        data
    );

info.checksumMatches =
    info.calculatedChecksum ===
    info.checksum;

return info;
```

}

function findGenesisHeader(data) {
/*
* Standard Genesis header starts at 0x100.
*
* We first check the canonical location,
* then search aligned locations as a fallback.
*/
if (
data.length >= 0x110 &&
readASCII(
data,
0x100,
4
) === "SEGA"
) {
return 0x100;
}

```
for (
    let offset = 0;
    offset + 4 <= data.length;
    offset += 2
) {
    if (
        readASCII(
            data,
            offset,
            4
        ) === "SEGA"
    ) {
        return offset;
    }
}

return -1;
```

}

function readVectorTable(data) {
const names = [
"Initial SSP",
"Reset",
"Bus Error",
"Address Error",
"Illegal Instruction",
"Divide by Zero",
"CHK",
"TRAPV",
"Privilege Violation",
"Trace",
"Line 1010",
"Line 1111",
"Reserved 12",
"Reserved 13",
"Reserved 14",
"Reserved 15",
"Uninitialized Interrupt",
"Reserved 17",
"Reserved 18",
"Reserved 19",
"Reserved 20",
"Reserved 21",
"Reserved 22",
"Reserved 23",
"Spurious Interrupt",
"Level 1 Interrupt",
"Level 2 Interrupt",
"Level 3 Interrupt",
"Level 4 Interrupt",
"Level 5 Interrupt",
"Level 6 Interrupt",
"Level 7 Interrupt"
];

```
const vectors = [];

for (
    let i = 0;
    i < 32;
    i++
) {
    vectors.push({
        number: i,

        name:
            names[i] ||
            `Vector ${i}`,

        address:
            read32BE(
                data,
                i * 4
            )
    });
}

return vectors;
```

}

/* =========================================================
GENESIS CHECKSUM
========================================================= */

function calculateGenesisChecksum(data) {
const header =
findGenesisHeader(data);

```
if (header < 0) {
    return 0;
}

const romStart =
    read32BE(
        data,
        header + 0x80
    );

const romEnd =
    read32BE(
        data,
        header + 0x84
    );

let start =
    Number.isFinite(romStart)
        ? romStart
        : 0x200;

let end =
    Number.isFinite(romEnd)
        ? romEnd
        : data.length - 1;

/*
 * Most Genesis headers say 0x200
 * through the final ROM byte.
 *
 * Clamp malformed headers safely.
 */
start = Math.max(
    0,
    Math.min(
        data.length,
        start
    )
);

end = Math.max(
    start - 1,
    Math.min(
        data.length - 1,
        end
    )
);

let checksum = 0;

for (
    let offset = start;
    offset <= end;
    offset += 2
) {
    checksum =
        (
            checksum +
            read16BE(
                data,
                offset
            )
        ) & 0xFFFF;
}

return checksum;
```

}

/* =========================================================
68000 OPCODE CLASSIFICATION
========================================================= */

function classifyOpcode(opcode) {
opcode &= 0xFFFF;

```
if (opcode === 0x4E71) {
    return "NOP";
}

if (opcode === 0x4E75) {
    return "RTS";
}

if (opcode === 0x4E73) {
    return "RTE";
}

if (opcode === 0x4E70) {
    return "RESET";
}

if (opcode === 0x4E72) {
    return "STOP";
}

if (opcode === 0x4E77) {
    return "RTR";
}

if (
    (opcode & 0xF000) === 0x7000
) {
    return "MOVEQ";
}

if (
    (opcode & 0xF000) === 0x1000
) {
    return "MOVE";
}

if (
    (opcode & 0xF000) === 0x2000
) {
    return "MOVE";
}

if (
    (opcode & 0xF000) === 0x3000
) {
    return "MOVE";
}

if (
    (opcode & 0xF000) === 0x6000
) {
    return "BRANCH";
}

if (
    (opcode & 0xF000) === 0x5000
) {
    return "ADDQ/SUBQ/SCC";
}

if (
    (opcode & 0xF000) === 0x9000
) {
    return "SUB";
}

if (
    (opcode & 0xF000) === 0xB000
) {
    return "CMP/EOR";
}

if (
    (opcode & 0xF000) === 0xD000
) {
    return "ADD";
}

if (
    (opcode & 0xF000) === 0xC000
) {
    return "AND/MUL/EXG";
}

if (
    (opcode & 0xF000) === 0x8000
) {
    return "OR/DIV";
}

if (
    (opcode & 0xF100) === 0x0100
) {
    return "BIT/CHG/CLR/SET";
}

if (
    (opcode & 0xF000) === 0x4000
) {
    return "MISC";
}

return "UNKNOWN";
```

}

function analyzeOpcodes(data) {
const counts = {};

```
let words = 0;

for (
    let offset = 0;
    offset + 1 < data.length;
    offset += 2
) {
    const opcode =
        read16BE(
            data,
            offset
        );

    const type =
        classifyOpcode(opcode);

    counts[type] =
        (counts[type] || 0) + 1;

    words++;
}

return {
    words,
    bytes: data.length,
    counts
};
```

}

/* =========================================================
ROM INFORMATION DISPLAY
========================================================= */

function displayROMInfo() {
romInfo.classList.remove(
"hidden"
);

```
romName.textContent =
    currentROM.name;

romSize.textContent =
    formatBytes(
        currentROMData.length
    );

romStatus.textContent =
    currentROMInfo &&
    currentROMInfo.headerFound
        ? "Genesis ROM detected"
        : "ROM loaded";

dropZone.classList.add(
    "has-rom"
);
```

}

/* =========================================================
SCRATCH ID GENERATOR
========================================================= */

let idCounter = 0;

function newID(prefix = "id") {
idCounter++;

```
return (
    `${prefix}_${idCounter}_` +
    Math.random()
        .toString(36)
        .slice(2, 8)
);
```

}

/* =========================================================
SCRATCH BLOCK GENERATOR
========================================================= */

function makeBlock(
opcode,
{
next = null,
parent = null,
inputs = {},
fields = {},
topLevel = false,
x = 0,
y = 0
} = {}
) {
const id =
newID("block");

```
return {
    id,

    block: {
        opcode,
        next,
        parent,
        inputs,
        fields,

        shadow: false,

        topLevel,

        x,
        y
    }
};
```

}

function createDiagnosticBlocks() {
const blocks = {};

```
const start =
    makeBlock(
        "event_whenflagclicked",
        {
            topLevel: true,
            x: 100,
            y: 100
        }
    );

blocks[start.id] =
    start.block;

const say =
    makeBlock(
        "looks_sayforsecs",
        {
            parent: start.id,

            inputs: {
                MESSAGE: [
                    1,
                    [
                        10,
                        "Genesis2SB3 v0.1.0"
                    ]
                ],

                SECS: [
                    1,
                    [
                        4,
                        "3"
                    ]
                ]
            }
        }
    );

blocks[say.id] =
    say.block;

blocks[start.id].next =
    say.id;

const say2 =
    makeBlock(
        "looks_say",
        {
            parent: say.id,

            inputs: {
                MESSAGE: [
                    1,
                    [
                        10,
                        "ROM loaded"
                    ]
                ]
            }
        }
    );

blocks[say2.id] =
    say2.block;

blocks[say.id].next =
    say2.id;

return blocks;
```

}

/* =========================================================
SCRATCH PROJECT JSON
========================================================= */

function createScratchProject(
rom,
info,
analysis
) {
const variables = {
"genesis_rom_size": [
"ROM Size",
rom.length
],

```
    "genesis_pc": [
        "Program Counter",
        info.resetVector
    ],

    "genesis_sp": [
        "Stack Pointer",
        info.initialSP
    ],

    "genesis_checksum": [
        "ROM Checksum",
        info.calculatedChecksum
    ]
};

const project = {
    targets: [
        {
            isStage: true,

            name: "Genesis2SB3",

            variables,

            lists: {},

            broadcasts: {},

            blocks:
                createDiagnosticBlocks(),

            comments: {},

            currentCostume: 0,

            costumes: [],

            sounds: [],

            volume: 100,

            layerOrder: 0,

            tempo: 60
        }
    ],

    monitors: [],

    extensions: [],

    meta: {
        semver: "3.0.0",

        vm: "0.2.0",

        agent:
            `Genesis2SB3/${VERSION}`
    }
};

/*
 * These fields are intentionally stored outside
 * the normal Scratch runtime structures.
 *
 * They document what the compiler discovered.
 */
project.genesis2sb3 = {
    compilerVersion: VERSION,

    title:
        info.title,

    console:
        info.console,

    domesticTitle:
        info.domesticTitle,

    internationalTitle:
        info.internationalTitle,

    serial:
        info.serial,

    version:
        info.version,

    region:
        info.region,

    romSize:
        rom.length,

    checksum:
        info.checksum,

    calculatedChecksum:
        info.calculatedChecksum,

    checksumMatches:
        info.checksumMatches,

    initialStackPointer:
        info.initialSP,

    resetVector:
        info.resetVector,

    instructionWords:
        analysis.words,

    opcodeClasses:
        analysis.counts,

    stage:
        "diagnostic",

    nextStage:
        "68000 CPU"
};

return project;
```

}

/* =========================================================
ZIP WRITER
========================================================= */

const CRC_TABLE =
new Uint32Array(256);

for (
let i = 0;
i < 256;
i++
) {
let c = i;

```
for (
    let j = 0;
    j < 8;
    j++
) {
    c =
        (c & 1)
            ? 0xEDB88320 ^
                (c >>> 1)
            : c >>> 1;
}

CRC_TABLE[i] =
    c >>> 0;
```

}

function crc32(data) {
let crc =
0xFFFFFFFF;

```
for (
    let i = 0;
    i < data.length;
    i++
) {
    crc =
        CRC_TABLE[
            (crc ^ data[i]) & 0xFF
        ] ^
        (crc >>> 8);
}

return (
    crc ^ 0xFFFFFFFF
) >>> 0;
```

}

function createStoredZip(files) {
const localParts = [];
const centralParts = [];

```
let offset = 0;

for (const file of files) {
    const name =
        new TextEncoder()
            .encode(file.name);

    const data =
        file.data;

    const checksum =
        crc32(data);

    const localHeader =
        concatBytes(
            new Uint8Array([
                0x50,
                0x4B,
                0x03,
                0x04
            ]),

            uint16LE(20),
            uint16LE(0),
            uint16LE(0),
            uint16LE(0),
            uint16LE(0),

            uint32LE(checksum),
            uint32LE(data.length),
            uint32LE(data.length),

            uint16LE(name.length),
            uint16LE(0),

            name
        );

    localParts.push(
        localHeader,
        data
    );

    const centralHeader =
        concatBytes(
            new Uint8Array([
                0x50,
                0x4B,
                0x01,
                0x02
            ]),

            uint16LE(20),
            uint16LE(20),

            uint16LE(0),
            uint16LE(0),

            uint16LE(0),
            uint16LE(0),

            uint32LE(checksum),
            uint32LE(data.length),
            uint32LE(data.length),

            uint16LE(name.length),
            uint16LE(0),
            uint16LE(0),
            uint16LE(0),
            uint16LE(0),

            uint32LE(0),
            uint32LE(offset),

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
    concatBytes(
        ...localParts
    );

const centralData =
    concatBytes(
        ...centralParts
    );

const endRecord =
    concatBytes(
        new Uint8Array([
            0x50,
            0x4B,
            0x05,
            0x06
        ]),

        uint16LE(0),
        uint16LE(0),

        uint16LE(files.length),
        uint16LE(files.length),

        uint32LE(
            centralData.length
        ),

        uint32LE(
            localData.length
        ),

        uint16LE(0)
    );

return concatBytes(
    localData,
    centralData,
    endRecord
);
```

}

/* =========================================================
SB3 COMPILER
========================================================= */

async function compileROM() {
if (!currentROMData) {
throw new Error(
"No ROM selected."
);
}

```
setProgress(
    5,
    "Parsing Genesis cartridge..."
);

await sleep(20);

const info =
    parseGenesisROM(
        currentROMData
    );

setProgress(
    20,
    "Reading vector table..."
);

await sleep(20);

const vectors =
    info.vectors;

if (!vectors.length) {
    throw new Error(
        "Could not read the Genesis vector table."
    );
}

setProgress(
    35,
    "Analyzing 68000 opcodes..."
);

await sleep(20);

const analysis =
    analyzeOpcodes(
        currentROMData
    );

setProgress(
    50,
    "Calculating ROM checksum..."
);

await sleep(20);

const calculated =
    calculateGenesisChecksum(
        currentROMData
    );

info.calculatedChecksum =
    calculated;

info.checksumMatches =
    calculated === info.checksum;

setProgress(
    65,
    "Generating Scratch project..."
);

await sleep(20);

const project =
    createScratchProject(
        currentROMData,
        info,
        analysis
    );

setProgress(
    78,
    "Encoding project.json..."
);

await sleep(20);

const projectJSON =
    JSON.stringify(
        project
    );

const projectBytes =
    new TextEncoder()
        .encode(projectJSON);

setProgress(
    88,
    "Creating SB3 archive..."
);

await sleep(20);

const zip =
    createStoredZip([
        {
            name: "project.json",
            data: projectBytes
        }
    ]);

setProgress(
    97,
    "Finalizing..."
);

await sleep(20);

generatedSB3 =
    new Blob(
        [zip],
        {
            type:
                "application/x.scratch.sb3"
        }
    );

setProgress(
    100,
    "Compilation complete."
);

return {
    info,
    analysis,
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
if (!currentROMData) {
setStatus(
"Select a ROM first.",
"error"
);

```
        return;
    }

    compileButton.disabled =
        true;

    result.classList.add(
        "hidden"
    );

    progressContainer.classList.remove(
        "hidden"
    );

    setStatus(
        "Starting Genesis2SB3 compiler..."
    );

    try {
        const output =
            await compileROM();

        const title =
            output.info.title ||
            currentROM.name;

        const checksumText =
            output.info.checksumMatches
                ? "Checksum matches."
                : "Checksum differs from the header.";

        resultText.textContent =
            `${title} analyzed successfully. ` +
            `${formatBytes(currentROMData.length)} ROM, ` +
            `${output.analysis.words.toLocaleString()} 68000 words. ` +
            checksumText;

        result.classList.remove(
            "hidden"
        );

        setStatus(
            "Genesis cartridge analysis complete.",
            "success"
        );

        console.log(
            "Genesis2SB3 analysis:",
            output
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

    compileButton.disabled =
        false;
}
```

);

/* =========================================================
DOWNLOAD
========================================================= */

downloadButton.addEventListener(
"click",
() => {
if (!generatedSB3) {
return;
}

```
    let filename =
        currentROM
            ? currentROM.name
            : "Genesis2SB3";

    filename =
        filename.replace(
            /\.[^/.]+$/,
            ""
        );

    filename +=
        "-genesis2sb3-v0.1.sb3";

    const url =
        URL.createObjectURL(
            generatedSB3
        );

    const link =
        document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(
        link
    );

    link.click();

    link.remove();

    setTimeout(
        () => {
            URL.revokeObjectURL(url);
        },
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
resetROM
);

function resetROM() {
currentROM = null;
currentROMData = null;
currentROMInfo = null;
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

compileButton.disabled =
    true;

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
KEYBOARD SHORTCUTS
========================================================= */

document.addEventListener(
"keydown",
event => {
if (
event.ctrlKey &&
event.key.toLowerCase() === "o"
) {
event.preventDefault();

```
        romInput.click();
    }

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

compileButton.disabled =
true;

setStatus(
"Select a Genesis ROM to begin."
);

console.log(
`Genesis2SB3 v${VERSION} initialized.`
);

console.log(
"Target: Sega Genesis / Motorola 68000"
);

console.log(
"Next compiler stage: 68000 CPU execution."
);
