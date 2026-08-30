const VERSION = "0.2.1";

let currentROM = null;
let currentROMData = null;
let currentROMInfo = null;
let generatedSB3 = null;

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

if (romInput) {
romInput.setAttribute("accept", ".bin,.gen,.md,.smd,/");
romInput.addEventListener("change", async e => {
if (e.target.files && e.target.files.length) {
await loadROM(e.target.files[0]);
}
});
}

if (dropZone) {
dropZone.addEventListener("dragover", e => {
e.preventDefault();
dropZone.classList.add("dragging");
});

dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragging");
});

dropZone.addEventListener("drop", async e => {
    e.preventDefault();
    dropZone.classList.remove("dragging");

    if (e.dataTransfer.files && e.dataTransfer.files.length) {
        await loadROM(e.dataTransfer.files[0]);
    }
});

}

if (removeRom) {
removeRom.addEventListener("click", resetROM);
}

if (compileButton) {
compileButton.addEventListener("click", async () => {
if (!currentROMData) {
setStatus("Select a ROM first.", "error");
return;
}

    compileButton.disabled = true;

    if (progressContainer) {
        progressContainer.classList.remove("hidden");
    }

    try {
        await compileROM();
        setStatus("Genesis CPU bootstrap generated successfully.", "success");
    } catch (error) {
        console.error(error);
        setStatus(`Compilation failed: ${error.message}`, "error");
    }

    compileButton.disabled = false;
});

}

if (downloadButton) {
downloadButton.addEventListener("click", downloadSB3);
}

async function loadROM(file) {
resetCompilation();

if (!file || !file.size) {
    setStatus("The selected file is empty.", "error");
    return;
}

try {
    setStatus(`Reading ${file.name}...`);

    let data = new Uint8Array(await file.arrayBuffer());

    let smd = false;

    if (isDefinitelySMD(data)) {
        data = deinterleaveSMD(data);
        smd = true;
    }

    currentROM = file;
    currentROMData = data;
    currentROMInfo = parseGenesisROM(data);

    displayROMInfo();

    if (currentROMInfo.headerFound) {
        setStatus(
            `${currentROMInfo.title} detected${smd ? " and converted from SMD format" : ""}.`,
            "success"
        );
    } else {
        setStatus(
            `${file.name} loaded. Genesis header was not detected.`,
            "warning"
        );
    }

    if (compileButton) {
        compileButton.disabled = false;
    }

} catch (error) {
    console.error(error);
    setStatus(`Could not read ROM: ${error.message}`, "error");
}

}

function findGenesisHeader(data) {
if (
data.length >= 0x104 &&
readASCII(data, 0x100, 4) === "SEGA"
) {
return 0x100;
}

for (let i = 0; i + 4 <= data.length; i++) {
    if (
        data[i] === 0x53 &&
        data[i + 1] === 0x45 &&
        data[i + 2] === 0x47 &&
        data[i + 3] === 0x41
    ) {
        return i;
    }
}

return -1;

}

function parseGenesisROM(data) {
const header = findGenesisHeader(data);

const base = {
    headerFound: false,
    title: "Unknown Genesis ROM",
    console: "",
    serial: "",
    region: "",
    checksum: 0,
    calculatedChecksum: 0,
    checksumMatches: false,
    initialSP: read32BE(data, 0),
    resetVector: read32BE(data, 4)
};

if (header < 0) {
    return base;
}

const info = {
    headerFound: true,
    headerOffset: header,

    console: readASCII(data, header, 16),

    domesticTitle:
        readASCII(data, header + 0x20, 48),

    internationalTitle:
        readASCII(data, header + 0x50, 48),

    serial:
        readASCII(data, header + 0x60, 14),

    version:
        readASCII(data, header + 0x6E, 2),

    checksum:
        read16BE(data, header + 0x7E),

    romStart:
        read32BE(data, header + 0x80),

    romEnd:
        read32BE(data, header + 0x84),

    ramStart:
        read32BE(data, header + 0x88),

    ramEnd:
        read32BE(data, header + 0x8C),

    region:
        readASCII(data, header + 0xF0, 16),

    initialSP:
        read32BE(data, 0),

    resetVector:
        read32BE(data, 4)
};

info.title =
    info.internationalTitle ||
    info.domesticTitle ||
    "Unknown Genesis ROM";

info.calculatedChecksum =
    calculateGenesisChecksum(data);

info.checksumMatches =
    info.checksum === info.calculatedChecksum;

return info;

}

function read16BE(data, offset) {
if (offset < 0 || offset + 1 >= data.length) {
return 0;
}

return (
    (data[offset] << 8) |
    data[offset + 1]
) >>> 0;

}

function read32BE(data, offset) {
if (offset < 0 || offset + 3 >= data.length) {
return 0;
}

return (
    data[offset] * 0x1000000 +
    data[offset + 1] * 0x10000 +
    data[offset + 2] * 0x100 +
    data[offset + 3]
) >>> 0;

}

function readASCII(data, offset, length) {
let text = "";

for (
    let i = 0;
    i < length &&
    offset + i < data.length;
    i++
) {
    const c = data[offset + i];

    text +=
        c >= 32 && c <= 126
            ? String.fromCharCode(c)
            : " ";
}

return text.replace(/\s+/g, " ").trim();

}

function formatHex(value, digits = 8) {
return "0x" +
(value >>> 0)
.toString(16)
.toUpperCase()
.padStart(digits, "0");
}

function formatBytes(bytes) {
if (bytes < 1024) {
return ${bytes} B;
}

if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
}

return `${(bytes / 1024 / 1024).toFixed(2)} MB`;

}

function calculateGenesisChecksum(data) {
let start = 0x200;
let end = data.length - 1;

const header = findGenesisHeader(data);

if (header >= 0) {
    const romStart = read32BE(data, header + 0x80);
    const romEnd = read32BE(data, header + 0x84);

    if (romStart < data.length) {
        start = romStart;
    }

    if (
        romEnd >= start &&
        romEnd < data.length
    ) {
        end = romEnd;
    }
}

let checksum = 0;

for (let i = start; i <= end; i += 2) {
    checksum =
        (
            checksum +
            read16BE(data, i)
        ) & 0xFFFF;
}

return checksum;

}

function isDefinitelySMD(data) {
return (
data.length >= 512 + 16384 &&
(data.length - 512) % 16384 === 0 &&
data[0] === 0x03 &&
data[1] === 0x00
);
}

function deinterleaveSMD(data) {
const body = data.slice(512);
const output = new Uint8Array(body.length);

for (
    let block = 0;
    block < body.length;
    block += 16384
) {
    const size =
        Math.min(
            16384,
            body.length - block
        );

    const half = Math.floor(size / 2);

    for (let i = 0; i < half; i++) {
        output[block + i * 2] =
            body[block + half + i];

        output[block + i * 2 + 1] =
            body[block + i];
    }
}

return output;

}

function displayROMInfo() {
if (romInfo) {
romInfo.classList.remove("hidden");
}

if (romName) {
    romName.textContent = currentROM.name;
}

if (romSize) {
    romSize.textContent =
        formatBytes(currentROMData.length);
}

if (romStatus) {
    romStatus.textContent =
        currentROMInfo.headerFound
            ? "Genesis ROM detected"
            : "ROM loaded";
}

if (dropZone) {
    dropZone.classList.add("has-rom");
}

}

async function compileROM() {
setProgress(5, "Reading Genesis reset vectors...");
await delay(30);

const info = currentROMInfo;

setProgress(20, "Preparing 68000 CPU state...");
await delay(30);

const cpu = createCPUState(info);

setProgress(35, "Encoding ROM for the runtime...");
await delay(30);

/*
 * We don't put the entire ROM into individual Scratch
 * variables. Instead, it is divided into chunks.
 *
 * This is only the first-stage runtime. Later versions
 * will replace this representation with a much more
 * efficient memory system.
 */
const romChunks =
    encodeROMChunks(currentROMData, 8192);

setProgress(55, "Generating Scratch CPU runtime...");
await delay(30);

const project =
    createRuntimeProject(
        info,
        cpu,
        romChunks
    );

setProgress(70, "Creating Scratch asset...");
await delay(30);

const svg =
    createRuntimeSVG(
        info,
        cpu
    );

const svgBytes =
    new TextEncoder().encode(svg);

const svgHash =
    md5(svgBytes);

updateAssetReferences(
    project,
    svgHash
);

/*
 * IMPORTANT:
 *
 * The ROM itself is represented in project.json
 * for this bootstrap build. We are NOT pretending
 * Scratch can execute an arbitrary .bin asset directly.
 *
 * The next optimization pass will move the ROM into
 * a much more efficient runtime representation.
 */

project.targets[0].variables.rom_data = [
    "ROM DATA",
    romChunks.join("|")
];

project.targets[0].variables.rom_length = [
    "ROM LENGTH",
    currentROMData.length
];

const projectBytes =
    new TextEncoder().encode(
        JSON.stringify(project)
    );

const zip =
    createZIP([
        {
            name: "project.json",
            data: projectBytes
        },
        {
            name: `${svgHash}.svg`,
            data: svgBytes
        }
    ]);

generatedSB3 =
    new Blob(
        [zip],
        {
            type: "application/x.scratch.sb3"
        }
    );

setProgress(
    100,
    "Genesis CPU bootstrap ready."
);

if (result) {
    result.classList.remove("hidden");
}

if (resultText) {
    resultText.textContent =
        `${info.title} generated with a 68000 bootstrap. ` +
        `Initial PC: ${formatHex(cpu.PC)}.`;
}

}

function createCPUState(info) {
return {
D0: 0,
D1: 0,
D2: 0,
D3: 0,
D4: 0,
D5: 0,
D6: 0,
D7: 0,

    A0: 0,
    A1: 0,
    A2: 0,
    A3: 0,
    A4: 0,
    A5: 0,
    A6: 0,

    A7:
        info.initialSP >>> 0,

    PC:
        info.resetVector >>> 0,

    SR:
        0x2700
};

}

function encodeROMChunks(data, chunkSize) {
const chunks = [];

for (
    let start = 0;
    start < data.length;
    start += chunkSize
) {
    const end =
        Math.min(
            start + chunkSize,
            data.length
        );

    let text = "";

    for (
        let i = start;
        i < end;
        i++
    ) {
        text +=
            data[i]
                .toString(16)
                .padStart(2, "0");
    }

    chunks.push(text);
}

return chunks;

}

function createRuntimeProject(
info,
cpu,
romChunks
) {
const stageFlag =
"stage_boot";

const stageInit =
    "stage_init";

const stageStatus =
    "stage_status";

const stagePC =
    "stage_pc";

const stageInstruction =
    "stage_instruction";

const stageLoop =
    "stage_loop";

const variables = {
    rom_data: [
        "ROM DATA",
        ""
    ],

    rom_length: [
        "ROM LENGTH",
        currentROMData.length
    ],

    cpu_pc: [
        "PC",
        formatHex(cpu.PC)
    ],

    cpu_sp: [
        "A7 / SP",
        formatHex(cpu.A7)
    ],

    cpu_sr: [
        "SR",
        formatHex(cpu.SR, 4)
    ],

    cpu_d0: [
        "D0",
        "0x00000000"
    ],

    cpu_d1: [
        "D1",
        "0x00000000"
    ],

    cpu_d2: [
        "D2",
        "0x00000000"
    ],

    cpu_d3: [
        "D3",
        "0x00000000"
    ],

    cpu_d4: [
        "D4",
        "0x00000000"
    ],

    cpu_d5: [
        "D5",
        "0x00000000"
    ],

    cpu_d6: [
        "D6",
        "0x00000000"
    ],

    cpu_d7: [
        "D7",
        "0x00000000"
    ],

    cpu_a0: [
        "A0",
        "0x00000000"
    ],

    cpu_a1: [
        "A1",
        "0x00000000"
    ],

    cpu_a2: [
        "A2",
        "0x00000000"
    ],

    cpu_a3: [
        "A3",
        "0x00000000"
    ],

    cpu_a4: [
        "A4",
        "0x00000000"
    ],

    cpu_a5: [
        "A5",
        "0x00000000"
    ],

    cpu_a6: [
        "A6",
        "0x00000000"
    ],

    cpu_a7: [
        "A7",
        formatHex(cpu.A7)
    ],

    cpu_instruction: [
        "CURRENT INSTRUCTION",
        "0x0000"
    ],

    cpu_running: [
        "CPU RUNNING",
        "YES"
    ],

    cpu_cycles: [
        "CPU CYCLES",
        0
    ]
};

const blocks = {};

blocks[stageFlag] = block(
    "event_whenflagclicked",
    stageInit,
    null,
    {},
    {},
    true,
    100,
    80
);

blocks[stageInit] = block(
    "data_setvariableto",
    stageStatus,
    stagePC,
    {
        VALUE: [
            1,
            formatHex(cpu.PC)
        ]
    },
    {
        VARIABLE: [
            "CPU RUNNING",
            "YES"
        ]
    }
);

blocks[stagePC] = block(
    "data_setvariableto",
    stageStatus,
    stageInstruction,
    {
        VALUE: [
            1,
            formatHex(cpu.PC)
        ]
    },
    {
        VARIABLE: [
            "PC",
            "0x00000000"
        ]
    }
);

blocks[stageInstruction] = block(
    "looks_say",
    stageLoop,
    null,
    {
        MESSAGE: [
            1,
            [
                10,
                `Genesis2SB3 CPU bootstrap: ${cleanScratchText(info.title)}`
            ]
        ]
    }
);

blocks[stageLoop] = block(
    "control_wait",
    null,
    stageInstruction,
    {
        DURATION: [
            1,
            [
                10,
                "0.01"
            ]
        ]
    }
);

const stage = {
    isStage: true,

    name: "Stage",

    variables,

    lists: {},

    broadcasts: {},

    blocks,

    comments: {},

    currentCostume: 0,

    costumes: [
        {
            assetId:
                "00000000000000000000000000000000",

            name: "backdrop1",

            bitmapResolution: 1,

            md5ext:
                "00000000000000000000000000000000.svg",

            dataFormat: "svg",

            rotationCenterX: 240,

            rotationCenterY: 180
        }
    ],

    sounds: [],

    volume: 100,

    layerOrder: 0,

    tempo: 60,

    videoTransparency: 50,

    videoState: "on",

    textToSpeechLanguage: null
};

const sprite = {
    isStage: false,

    name: "Genesis CPU",

    variables: {},

    lists: {},

    broadcasts: {},

    blocks: {},

    comments: {},

    currentCostume: 0,

    costumes: [
        {
            assetId:
                "00000000000000000000000000000000",

            name: "runtime",

            bitmapResolution: 1,

            md5ext:
                "00000000000000000000000000000000.svg",

            dataFormat: "svg",

            rotationCenterX: 240,

            rotationCenterY: 180
        }
    ],

    sounds: [],

    volume: 100,

    layerOrder: 1,

    visible: true,

    x: 0,

    y: 0,

    size: 100,

    direction: 90,

    draggable: false,

    rotationStyle: "all around"
};

return {
    targets: [
        stage,
        sprite
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

}

function block(
opcode,
next,
parent,
inputs = {},
fields = {},
topLevel = false,
x = 0,
y = 0
) {
return {
opcode,
next,
parent,
inputs,
fields,
shadow: false,
topLevel,
...(topLevel ? { x, y } : {})
};
}

function updateAssetReferences(project, hash) {
for (const target of project.targets) {
if (
target.costumes &&
target.costumes.length
) {
for (const costume of target.costumes) {
costume.assetId = hash;
costume.md5ext =
${hash}.svg;
}
}
}
}

function createRuntimeSVG(info, cpu) {
const title =
escapeXML(
cleanScratchText(info.title)
);

const pc =
    escapeXML(
        formatHex(cpu.PC)
    );

const sp =
    escapeXML(
        formatHex(cpu.A7)
    );

return `<?xml version="1.0" encoding="UTF-8"?>

<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360">

<rect width="480" height="360" fill="#111111"/>

<text x="240" y="90" text-anchor="middle" font-family="Arial" font-size="25" fill="#ffffff">
Genesis2SB3
</text>

<text x="240" y="135" text-anchor="middle" font-family="Arial" font-size="17" fill="#ffffff">
${title}
</text>

<text x="240" y="185" text-anchor="middle" font-family="monospace" font-size="15" fill="#ffffff">
68000 CPU
</text>

<text x="240" y="215" text-anchor="middle" font-family="monospace" font-size="14" fill="#ffffff">
Initial PC: ${pc}
</text>

<text x="240" y="240" text-anchor="middle" font-family="monospace" font-size="14" fill="#ffffff">
Initial A7: ${sp}
</text>

<text x="240" y="290" text-anchor="middle" font-family="Arial" font-size="13" fill="#aaaaaa">
Genesis2SB3 v${VERSION}
</text>

</svg>`;
}

function escapeXML(text) {
return String(text)
.replace(/&/g, "&")
.replace(/</g, "<")
.replace(/>/g, ">")
.replace(/"/g, """)
.replace(/'/g, "'");
}

function cleanScratchText(text) {
return String(text || "Unknown Genesis ROM")
.replace(/\0/g, "")
.replace(/\s+/g, " ")
.trim()
.slice(0, 200);
}

function md5(input) {
const bytes =
input instanceof Uint8Array
? input
: new Uint8Array(input);

const length = bytes.length;
const bitLength = length * 8;
const paddedLength =
    ((length + 9 + 63) >> 6) << 6;

const buffer =
    new Uint8Array(paddedLength);

buffer.set(bytes);
buffer[length] = 0x80;

const view =
    new DataView(buffer.buffer);

view.setUint32(
    paddedLength - 8,
    bitLength >>> 0,
    true
);

view.setUint32(
    paddedLength - 4,
    Math.floor(
        bitLength / 0x100000000
    ),
    true
);

let a0 = 0x67452301;
let b0 = 0xefcdab89;
let c0 = 0x98badcfe;
let d0 = 0x10325476;

const s = [
    7,12,17,22,7,12,17,22,
    7,12,17,22,7,12,17,22,
    5,9,14,20,5,9,14,20,
    5,9,14,20,5,9,14,20,
    4,11,16,23,4,11,16,23,
    4,11,16,23,4,11,16,23,
    6,10,15,21,6,10,15,21,
    6,10,15,21,6,10,15,21
];

const K =
    new Uint32Array(64);

for (let i = 0; i < 64; i++) {
    K[i] =
        Math.floor(
            Math.abs(
                Math.sin(i + 1)
            ) *
            0x100000000
        ) >>> 0;
}

for (
    let offset = 0;
    offset < buffer.length;
    offset += 64
) {
    const M =
        new Uint32Array(16);

    for (let i = 0; i < 16; i++) {
        M[i] =
            view.getUint32(
                offset + i * 4,
                true
            );
    }

    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;

    for (let i = 0; i < 64; i++) {
        let F;
        let g;

        if (i < 16) {
            F =
                (B & C) |
                ((~B) & D);
            g = i;
        } else if (i < 32) {
            F =
                (D & B) |
                ((~D) & C);
            g =
                (5 * i + 1) % 16;
        } else if (i < 48) {
            F = B ^ C ^ D;
            g =
                (3 * i + 5) % 16;
        } else {
            F =
                C ^
                (B | (~D));
            g =
                (7 * i) % 16;
        }

        const temp = D;
        D = C;
        C = B;

        const sum =
            (
                A +
                F +
                K[i] +
                M[g]
            ) >>> 0;

        B =
            (
                B +
                leftRotate(
                    sum,
                    s[i]
                )
            ) >>> 0;

        A = temp;
    }

    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
}

return [
    a0,
    b0,
    c0,
    d0
].map(v => {
    return v
        .toString(16)
        .padStart(8, "0")
        .match(/../g)
        .reverse()
        .join("");
}).join("");

}

function leftRotate(value, amount) {
return (
(value << amount) |
(value >>> (32 - amount))
) >>> 0;
}

const CRC_TABLE =
new Uint32Array(256);

for (let i = 0; i < 256; i++) {
let c = i;

for (let j = 0; j < 8; j++) {
    c =
        c & 1
            ? 0xEDB88320 ^ (c >>> 1)
            : c >>> 1;
}

CRC_TABLE[i] = c >>> 0;

}

function crc32(data) {
let crc = 0xFFFFFFFF;

for (let i = 0; i < data.length; i++) {
    crc =
        CRC_TABLE[
            (crc ^ data[i]) & 0xFF
        ] ^
        (crc >>> 8);
}

return (
    crc ^
    0xFFFFFFFF
) >>> 0;

}

function createZIP(files) {
const local = [];
const central = [];

let offset = 0;

for (const file of files) {
    const name =
        new TextEncoder().encode(
            file.name
        );

    const data = file.data;
    const checksum = crc32(data);

    const header =
        concatBytes(
            bytes(
                0x50,0x4B,0x03,0x04
            ),

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

    local.push(header, data);

    const centralHeader =
        concatBytes(
            bytes(
                0x50,0x4B,0x01,0x02
            ),

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

    central.push(centralHeader);

    offset +=
        header.length +
        data.length;
}

const localData =
    concatBytes(...local);

const centralData =
    concatBytes(...central);

const end =
    concatBytes(
        bytes(
            0x50,0x4B,0x05,0x06
        ),

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
    end
);

}

function bytes(...values) {
return new Uint8Array(values);
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

function concatBytes(...arrays) {
let length = 0;

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

}

function downloadSB3() {
if (!generatedSB3) {
return;
}

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
    "-Genesis2SB3-v0.2.1.sb3";

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

setTimeout(() => {
    URL.revokeObjectURL(url);
}, 1000);

}

function resetROM() {
currentROM = null;
currentROMData = null;
currentROMInfo = null;
generatedSB3 = null;

if (romInput) {
    romInput.value = "";
}

if (romInfo) {
    romInfo.classList.add("hidden");
}

if (result) {
    result.classList.add("hidden");
}

if (progressContainer) {
    progressContainer.classList.add("hidden");
}

if (dropZone) {
    dropZone.classList.remove("has-rom");
}

if (romStatus) {
    romStatus.textContent =
        "No ROM selected";
}

if (compileButton) {
    compileButton.disabled = true;
}

setStatus(
    "Select a Genesis ROM to begin."
);

}

function resetCompilation() {
generatedSB3 = null;

if (result) {
    result.classList.add("hidden");
}

if (progressContainer) {
    progressContainer.classList.add("hidden");
}

}

function setProgress(percent, message) {
if (progressBar) {
progressBar.style.width =
${percent}%;
}

if (progressPercent) {
    progressPercent.textContent =
        `${percent}%`;
}

if (progressText) {
    progressText.textContent =
        message;
}

}

function setStatus(message, type = "") {
if (!status) {
return;
}

status.textContent = message;
status.className = "status";

if (type) {
    status.classList.add(type);
}

}

function delay(ms) {
return new Promise(resolve => {
setTimeout(resolve, ms);
});
}

window.Genesis2SB3 = {
version: VERSION,

getROM() {
    return currentROM;
},

getROMData() {
    return currentROMData;
},

getROMInfo() {
    return currentROMInfo;
},

inspect() {
    if (!currentROMData) {
        return null;
    }

    return parseGenesisROM(
        currentROMData
    );
}

};

console.log(
Genesis2SB3 v${VERSION} ready.
);
