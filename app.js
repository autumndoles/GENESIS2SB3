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

console.log("Genesis2SB3 v" + VERSION + " loading...");

if (!romInput) {
console.error("ERROR: #romInput was not found.");
} else {
console.log("ROM input found.");

```
romInput.addEventListener("change", function(event) {
    console.log("FILE INPUT FIRED");

    var files = event.target.files;

    if (!files || files.length === 0) {
        console.log("No file selected.");
        return;
    }

    loadROM(files[0]);
});
```

}

if (dropZone) {
dropZone.addEventListener("dragover", function(event) {
event.preventDefault();
dropZone.classList.add("dragging");
});

```
dropZone.addEventListener("dragleave", function() {
    dropZone.classList.remove("dragging");
});

dropZone.addEventListener("drop", function(event) {
    event.preventDefault();
    dropZone.classList.remove("dragging");

    var files = event.dataTransfer.files;

    if (files && files.length > 0) {
        loadROM(files[0]);
    }
});
```

}

if (removeRom) {
removeRom.addEventListener("click", function() {
resetROM();
});
}

if (compileButton) {
compileButton.addEventListener("click", function() {
if (!currentROMData) {
setStatus("Select a ROM first.", "error");
return;
}

```
    compileROM();
});
```

}

if (downloadButton) {
downloadButton.addEventListener("click", function() {
downloadSB3();
});
}

async function loadROM(file) {
if (!file) {
setStatus("No file selected.", "error");
return;
}

```
try {
    console.log("Loading ROM:", file.name);
    console.log("File type:", file.type);
    console.log("File size:", file.size);

    setStatus("Reading " + file.name + "...");

    var buffer = await file.arrayBuffer();
    var data = new Uint8Array(buffer);

    console.log("Read", data.length, "bytes.");

    if (data.length === 0) {
        throw new Error("The selected file is empty.");
    }

    /*
     * Genesis SMD files contain a 512-byte header and
     * interleaved ROM data. Convert them before parsing.
     */
    if (isSMD(data)) {
        console.log("SMD format detected.");
        data = deinterleaveSMD(data);
        console.log("SMD converted to", data.length, "bytes.");
    }

    currentROM = file;
    currentROMData = data;
    currentROMInfo = parseGenesisROM(data);

    displayROMInfo();

    if (currentROMInfo.headerFound) {
        setStatus(
            "ROM detected: " +
            currentROMInfo.title,
            "success"
        );
    } else {
        setStatus(
            "ROM loaded, but a standard Genesis header was not found.",
            "warning"
        );
    }

    if (compileButton) {
        compileButton.disabled = false;
    }

} catch (error) {
    console.error(error);

    currentROM = null;
    currentROMData = null;
    currentROMInfo = null;

    setStatus(
        "Could not read ROM: " + error.message,
        "error"
    );
}
```

}

function parseGenesisROM(data) {
var header = findGenesisHeader(data);

```
var info = {
    headerFound: false,
    headerOffset: -1,
    title: "Unknown Genesis ROM",
    domesticTitle: "",
    internationalTitle: "",
    console: "",
    serial: "",
    version: "",
    region: "",
    checksum: 0,
    calculatedChecksum: 0,
    checksumMatches: false,
    initialSP: read32BE(data, 0),
    resetVector: read32BE(data, 4),
    romStart: 0,
    romEnd: data.length - 1
};

if (header < 0) {
    return info;
}

info.headerFound = true;
info.headerOffset = header;

info.console = readASCII(data, header, 16);

info.domesticTitle =
    readASCII(data, header + 0x20, 48);

info.internationalTitle =
    readASCII(data, header + 0x50, 48);

info.serial =
    readASCII(data, header + 0x60, 14);

info.version =
    readASCII(data, header + 0x6E, 2);

info.checksum =
    read16BE(data, header + 0x7E);

info.romStart =
    read32BE(data, header + 0x80);

info.romEnd =
    read32BE(data, header + 0x84);

info.region =
    readASCII(data, header + 0xF0, 16);

info.title =
    info.internationalTitle ||
    info.domesticTitle ||
    "Unknown Genesis ROM";

if (info.romStart >= data.length) {
    info.romStart = 0x200;
}

if (
    info.romEnd < info.romStart ||
    info.romEnd >= data.length
) {
    info.romEnd = data.length - 1;
}

info.calculatedChecksum =
    calculateGenesisChecksum(
        data,
        info.romStart,
        info.romEnd
    );

info.checksumMatches =
    info.checksum === info.calculatedChecksum;

return info;
```

}

function findGenesisHeader(data) {
/*
* Standard Genesis/Mega Drive ROM header.
* "SEGA" normally begins at 0x100.
*/
if (
data.length >= 0x104 &&
data[0x100] === 0x53 &&
data[0x101] === 0x45 &&
data[0x102] === 0x47 &&
data[0x103] === 0x41
) {
return 0x100;
}

```
/*
 * Some files have extra data before the ROM.
 * Search for a SEGA signature as a fallback.
 */
for (
    var i = 0;
    i + 4 <= data.length;
    i++
) {
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
```

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
    (
        data[offset] * 0x1000000
    ) +
    (
        data[offset + 1] * 0x10000
    ) +
    (
        data[offset + 2] * 0x100
    ) +
    data[offset + 3]
) >>> 0;
```

}

function readASCII(data, offset, length) {
var text = "";

```
for (
    var i = 0;
    i < length &&
    offset + i < data.length;
    i++
) {
    var value = data[offset + i];

    if (
        value >= 32 &&
        value <= 126
    ) {
        text += String.fromCharCode(value);
    } else {
        text += " ";
    }
}

return text
    .replace(/\s+/g, " ")
    .trim();
```

}

function calculateGenesisChecksum(
data,
start,
end
) {
if (start < 0) {
start = 0x200;
}

```
if (end >= data.length) {
    end = data.length - 1;
}

var checksum = 0;

for (
    var i = start;
    i <= end;
    i += 2
) {
    checksum =
        (
            checksum +
            read16BE(data, i)
        ) & 0xFFFF;
}

return checksum;
```

}

function isSMD(data) {
/*
* Typical SMD:
* 512-byte header followed by 16 KiB blocks.
*/
if (data.length < 512 + 16384) {
return false;
}

```
if (
    (data.length - 512) % 16384 !== 0
) {
    return false;
}

return (
    data[0] === 0x03 &&
    data[1] === 0x00
);
```

}

function deinterleaveSMD(data) {
var body = data.slice(512);
var output =
new Uint8Array(body.length);

```
for (
    var block = 0;
    block < body.length;
    block += 16384
) {
    var size =
        Math.min(
            16384,
            body.length - block
        );

    var half =
        Math.floor(size / 2);

    for (
        var i = 0;
        i < half;
        i++
    ) {
        output[block + i * 2] =
            body[block + half + i];

        output[block + i * 2 + 1] =
            body[block + i];
    }
}

return output;
```

}

function displayROMInfo() {
if (romInfo) {
romInfo.classList.remove("hidden");
}

```
if (romName) {
    romName.textContent =
        currentROM.name;
}

if (romSize) {
    romSize.textContent =
        formatBytes(
            currentROMData.length
        );
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
```

}

async function compileROM() {
if (!currentROMData) {
setStatus(
"No ROM loaded.",
"error"
);
return;
}

```
if (compileButton) {
    compileButton.disabled = true;
}

if (result) {
    result.classList.add("hidden");
}

if (progressContainer) {
    progressContainer.classList.remove("hidden");
}

try {
    setProgress(
        5,
        "Reading Genesis reset vectors..."
    );

    await delay(20);

    var cpu =
        createCPUState(
            currentROMInfo
        );

    setProgress(
        20,
        "Initializing Motorola 68000..."
    );

    await delay(20);

    /*
     * Fetch the first instruction from the
     * Genesis reset vector.
     */
    var initialOpcode =
        readROMWord(
            currentROMData,
            cpu.PC
        );

    cpu.initialOpcode =
        initialOpcode;

    setProgress(
        35,
        "Encoding ROM data..."
    );

    await delay(20);

    /*
     * For this prototype, ROM data is stored
     * in compact hexadecimal chunks.
     */
    var romChunks =
        encodeROMChunks(
            currentROMData,
            8192
        );

    setProgress(
        55,
        "Generating Scratch runtime..."
    );

    await delay(20);

    var project =
        createRuntimeProject(
            currentROMInfo,
            cpu,
            romChunks
        );

    setProgress(
        70,
        "Creating Scratch assets..."
    );

    await delay(20);

    var svg =
        createRuntimeSVG(
            currentROMInfo,
            cpu
        );

    var svgBytes =
        new TextEncoder().encode(svg);

    var svgHash =
        md5(svgBytes);

    updateAssetReferences(
        project,
        svgHash
    );

    /*
     * Keep the ROM in project variables for
     * this prototype. Later versions can use
     * a more efficient representation.
     */
    project.targets[0].variables.rom_data = [
        "ROM DATA",
        romChunks.join("|")
    ];

    project.targets[0].variables.rom_length = [
        "ROM LENGTH",
        currentROMData.length
    ];

    var projectBytes =
        new TextEncoder().encode(
            JSON.stringify(project)
        );

    setProgress(
        85,
        "Packaging SB3..."
    );

    await delay(20);

    var zip =
        createZIP([
            {
                name: "project.json",
                data: projectBytes
            },
            {
                name:
                    svgHash + ".svg",
                data: svgBytes
            }
        ]);

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

    if (result) {
        result.classList.remove("hidden");
    }

    if (resultText) {
        resultText.textContent =
            currentROMInfo.title +
            " compiled successfully. " +
            "Initial PC: " +
            formatHex(cpu.PC) +
            ". Initial opcode: " +
            formatHex(
                cpu.initialOpcode,
                4
            ) +
            ".";
    }

    setStatus(
        "SB3 generated successfully.",
        "success"
    );

} catch (error) {
    console.error(error);

    setStatus(
        "Compilation failed: " +
        error.message,
        "error"
    );
}

if (compileButton) {
    compileButton.disabled =
        !currentROMData;
}
```

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

```
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
        0x2700,

    initialOpcode: 0
};
```

}

function readROMWord(data, address) {
/*
* Genesis cartridge ROM is mapped at 0x000000.
* Masking lets us safely inspect addresses within
* the ROM while we're still building the memory map.
*/
var offset =
address >>> 0;

```
if (
    offset < 0 ||
    offset + 1 >= data.length
) {
    return 0;
}

return read16BE(
    data,
    offset
);
```

}

function encodeROMChunks(
data,
chunkSize
) {
var chunks = [];

```
for (
    var start = 0;
    start < data.length;
    start += chunkSize
) {
    var end =
        Math.min(
            start + chunkSize,
            data.length
        );

    var text = "";

    for (
        var i = start;
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
```

}

function createRuntimeProject(
info,
cpu,
romChunks
) {
var variables = {
rom_data: [
"ROM DATA",
""
],

```
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

    cpu_instruction: [
        "CURRENT INSTRUCTION",
        formatHex(
            cpu.initialOpcode,
            4
        )
    ],

    cpu_running: [
        "CPU RUNNING",
        "YES"
    ],

    cpu_cycles: [
        "CPU CYCLES",
        0
    ],

    controller_a: [
        "GENESIS A",
        0
    ],

    controller_b: [
        "GENESIS B",
        0
    ],

    controller_c: [
        "GENESIS C",
        0
    ]
};

for (
    var i = 0;
    i < 8;
    i++
) {
    variables["cpu_d" + i] = [
        "D" + i,
        "0x00000000"
    ];
}

for (
    var j = 0;
    j < 7;
    j++
) {
    variables["cpu_a" + j] = [
        "A" + j,
        "0x00000000"
    ];
}

variables.cpu_a7 = [
    "A7",
    formatHex(cpu.A7)
];

var blocks = {};

var flagID = "genesis_flag";
var statusID = "genesis_status";
var waitID = "genesis_wait";

blocks[flagID] = {
    opcode:
        "event_whenflagclicked",

    next:
        statusID,

    parent:
        null,

    inputs: {},

    fields: {},

    shadow:
        false,

    topLevel:
        true,

    x: 100,

    y: 100
};

blocks[statusID] = {
    opcode:
        "looks_say",

    next:
        waitID,

    parent:
        flagID,

    inputs: {
        MESSAGE: [
            1,
            [
                10,
                "Genesis2SB3: " +
                cleanScratchText(
                    info.title
                ) +
                " | PC " +
                formatHex(cpu.PC)
            ]
        ]
    },

    fields: {},

    shadow:
        false,

    topLevel:
        false
};

blocks[waitID] = {
    opcode:
        "control_wait",

    next:
        null,

    parent:
        statusID,

    inputs: {
        DURATION: [
            1,
            [
                10,
                "0.05"
            ]
        ]
    },

    fields: {},

    shadow:
        false,

    topLevel:
        false
};

var stage = {
    isStage: true,

    name: "Stage",

    variables: variables,

    lists: {},

    broadcasts: {},

    blocks: blocks,

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

var sprite = {
    isStage: false,

    name: "Genesis CPU",

    variables: {},

    lists: {},

    broadcasts: {},

    blocks: {},

    comments: {},

    currentCostume: 0,

    costumes: [],

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
            "Genesis2SB3/" +
            VERSION
    }
};
```

}

function createRuntimeSVG(
info,
cpu
) {
var title =
escapeXML(
cleanScratchText(
info.title
)
);

```
var pc =
    escapeXML(
        formatHex(cpu.PC)
    );

var sp =
    escapeXML(
        formatHex(cpu.A7)
    );

var opcode =
    escapeXML(
        formatHex(
            cpu.initialOpcode,
            4
        )
    );

return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<svg xmlns="http://www.w3.org/2000/svg" ' +
    'width="480" height="360" ' +
    'viewBox="0 0 480 360">' +

    '<rect width="480" height="360" ' +
    'fill="#111111"/>' +

    '<text x="240" y="75" ' +
    'text-anchor="middle" ' +
    'font-family="Arial" ' +
    'font-size="25" ' +
    'fill="#ffffff">' +
    'Genesis2SB3' +
    '</text>' +

    '<text x="240" y="115" ' +
    'text-anchor="middle" ' +
    'font-family="Arial" ' +
    'font-size="17" ' +
    'fill="#ffffff">' +
    title +
    '</text>' +

    '<text x="240" y="165" ' +
    'text-anchor="middle" ' +
    'font-family="monospace" ' +
    'font-size="15" ' +
    'fill="#ffffff">' +
    '68000 CPU BOOTSTRAP' +
    '</text>' +

    '<text x="240" y="195" ' +
    'text-anchor="middle" ' +
    'font-family="monospace" ' +
    'font-size="14" ' +
    'fill="#ffffff">' +
    'PC: ' +
    pc +
    '</text>' +

    '<text x="240" y="220" ' +
    'text-anchor="middle" ' +
    'font-family="monospace" ' +
    'font-size="14" ' +
    'fill="#ffffff">' +
    'A7: ' +
    sp +
    '</text>' +

    '<text x="240" y="245" ' +
    'text-anchor="middle" ' +
    'font-family="monospace" ' +
    'font-size="14" ' +
    'fill="#ffffff">' +
    'OPCODE: ' +
    opcode +
    '</text>' +

    '<text x="240" y="295" ' +
    'text-anchor="middle" ' +
    'font-family="Arial" ' +
    'font-size="13" ' +
    'fill="#aaaaaa">' +
    'TurboWarp recommended' +
    '</text>' +

    '<text x="240" y="320" ' +
    'text-anchor="middle" ' +
    'font-family="Arial" ' +
    'font-size="12" ' +
    'fill="#777777">' +
    'Genesis2SB3 v' +
    VERSION +
    '</text>' +

    '</svg>'
);
```

}

function updateAssetReferences(
project,
hash
) {
for (
var i = 0;
i < project.targets.length;
i++
) {
var target =
project.targets[i];

```
    if (
        target.costumes &&
        target.costumes.length
    ) {
        for (
            var j = 0;
            j < target.costumes.length;
            j++
        ) {
            target.costumes[j].assetId =
                hash;

            target.costumes[j].md5ext =
                hash + ".svg";
        }
    }
}
```

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
return String(
text || "Unknown Genesis ROM"
)
.replace(/\0/g, "")
.replace(/\s+/g, " ")
.trim()
.slice(0, 200);
}

function formatHex(
value,
digits
) {
if (digits === undefined) {
digits = 8;
}

```
return (
    "0x" +
    (value >>> 0)
        .toString(16)
        .toUpperCase()
        .padStart(
            digits,
            "0"
        )
);
```

}

function formatBytes(bytes) {
if (bytes < 1024) {
return bytes + " B";
}

```
if (bytes < 1024 * 1024) {
    return (
        (bytes / 1024).toFixed(2) +
        " KB"
    );
}

return (
    (bytes / 1024 / 1024).toFixed(2) +
    " MB"
);
```

}

function setProgress(
percent,
message
) {
if (progressBar) {
progressBar.style.width =
percent + "%";
}

```
if (progressPercent) {
    progressPercent.textContent =
        percent + "%";
}

if (progressText) {
    progressText.textContent =
        message;
}
```

}

function setStatus(
message,
type
) {
if (!status) {
return;
}

```
status.textContent =
    message;

status.className =
    "status";

if (type) {
    status.classList.add(type);
}
```

}

function resetROM() {
currentROM = null;
currentROMData = null;
currentROMInfo = null;
generatedSB3 = null;

```
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
    dropZone.classList.remove(
        "has-rom"
    );
}

if (romStatus) {
    romStatus.textContent =
        "No ROM selected";
}

if (compileButton) {
    compileButton.disabled =
        true;
}

setStatus(
    "Select a Genesis ROM to begin."
);
```

}

function downloadSB3() {
if (!generatedSB3) {
setStatus(
"There is no generated SB3 to download.",
"error"
);
return;
}

```
var filename =
    currentROM
        ? currentROM.name
        : "Genesis2SB3";

filename =
    filename.replace(
        /\.[^/.]+$/,
        ""
    );

filename +=
    "-Genesis2SB3-v" +
    VERSION +
    ".sb3";

var url =
    URL.createObjectURL(
        generatedSB3
    );

var link =
    document.createElement(
        "a"
    );

link.href = url;
link.download = filename;

document.body.appendChild(link);

link.click();

link.remove();

setTimeout(
    function() {
        URL.revokeObjectURL(url);
    },
    1000
);
```

}

function delay(ms) {
return new Promise(
function(resolve) {
setTimeout(
resolve,
ms
);
}
);
}

/*

* Minimal MD5 implementation.
* Scratch requires costume asset IDs to match
* the MD5 hash of the asset data.
  */

function md5(input) {
var bytes =
input instanceof Uint8Array
? input
: new Uint8Array(input);

```
var length =
    bytes.length;

var bitLength =
    length * 8;

var paddedLength =
    ((length + 9 + 63) >> 6) << 6;

var buffer =
    new Uint8Array(
        paddedLength
    );

buffer.set(bytes);

buffer[length] =
    0x80;

var view =
    new DataView(
        buffer.buffer
    );

view.setUint32(
    paddedLength - 8,
    bitLength >>> 0,
    true
);

view.setUint32(
    paddedLength - 4,
    Math.floor(
        bitLength /
        0x100000000
    ),
    true
);

var a0 =
    0x67452301;

var b0 =
    0xefcdab89;

var c0 =
    0x98badcfe;

var d0 =
    0x10325476;

var s = [
    7,12,17,22,
    7,12,17,22,
    7,12,17,22,
    7,12,17,22,

    5,9,14,20,
    5,9,14,20,
    5,9,14,20,
    5,9,14,20,

    4,11,16,23,
    4,11,16,23,
    4,11,16,23,
    4,11,16,23,

    6,10,15,21,
    6,10,15,21,
    6,10,15,21,
    6,10,15,21
];

var K =
    new Uint32Array(64);

for (
    var i = 0;
    i < 64;
    i++
) {
    K[i] =
        Math.floor(
            Math.abs(
                Math.sin(
                    i + 1
                )
            ) *
            0x100000000
        ) >>> 0;
}

for (
    var offset = 0;
    offset < buffer.length;
    offset += 64
) {
    var M =
        new Uint32Array(16);

    for (
        var j = 0;
        j < 16;
        j++
    ) {
        M[j] =
            view.getUint32(
                offset +
                j * 4,
                true
            );
    }

    var A = a0;
    var B = b0;
    var C = c0;
    var D = d0;

    for (
        var round = 0;
        round < 64;
        round++
    ) {
        var F;
        var g;

        if (round < 16) {
            F =
                (B & C) |
                ((~B) & D);

            g = round;

        } else if (
            round < 32
        ) {
            F =
                (D & B) |
                ((~D) & C);

            g =
                (5 * round + 1) %
                16;

        } else if (
            round < 48
        ) {
            F =
                B ^ C ^ D;

            g =
                (3 * round + 5) %
                16;

        } else {
            F =
                C ^
                (B | (~D));

            g =
                (7 * round) %
                16;
        }

        var temp = D;

        D = C;
        C = B;

        var sum =
            (
                A +
                F +
                K[round] +
                M[g]
            ) >>> 0;

        B =
            (
                B +
                leftRotate(
                    sum,
                    s[round]
                )
            ) >>> 0;

        A = temp;
    }

    a0 =
        (a0 + A) >>> 0;

    b0 =
        (b0 + B) >>> 0;

    c0 =
        (c0 + C) >>> 0;

    d0 =
        (d0 + D) >>> 0;
}

return [
    a0,
    b0,
    c0,
    d0
]
    .map(function(value) {
        return value
            .toString(16)
            .padStart(8, "0")
            .match(/../g)
            .reverse()
            .join("");
    })
    .join("");
```

}

function leftRotate(
value,
amount
) {
return (
(
value << amount
) |
(
value >>>
(32 - amount)
)
) >>> 0;
}

var CRC_TABLE =
new Uint32Array(256);

for (
var i = 0;
i < 256;
i++
) {
var c = i;

```
for (
    var j = 0;
    j < 8;
    j++
) {
    c =
        c & 1
            ? 0xEDB88320 ^
              (c >>> 1)
            : c >>> 1;
}

CRC_TABLE[i] =
    c >>> 0;
```

}

function crc32(data) {
var crc =
0xFFFFFFFF;

```
for (
    var i = 0;
    i < data.length;
    i++
) {
    crc =
        CRC_TABLE[
            (crc ^ data[i]) &
            0xFF
        ] ^
        (crc >>> 8);
}

return (
    crc ^
    0xFFFFFFFF
) >>> 0;
```

}

function createZIP(files) {
var local = [];
var central = [];

```
var offset = 0;

for (
    var i = 0;
    i < files.length;
    i++
) {
    var file =
        files[i];

    var name =
        new TextEncoder().encode(
            file.name
        );

    var data =
        file.data;

    var checksum =
        crc32(data);

    var localHeader =
        concatBytes(
            bytes(
                0x50,
                0x4B,
                0x03,
                0x04
            ),

            uint16LE(20),
            uint16LE(0),
            uint16LE(0),
            uint16LE(0),
            uint16LE(0),

            uint32LE(
                checksum
            ),

            uint32LE(
                data.length
            ),

            uint32LE(
                data.length
            ),

            uint16LE(
                name.length
            ),

            uint16LE(0),

            name
        );

    local.push(
        localHeader
    );

    local.push(data);

    var centralHeader =
        concatBytes(
            bytes(
                0x50,
                0x4B,
                0x01,
                0x02
            ),

            uint16LE(20),
            uint16LE(20),
            uint16LE(0),
            uint16LE(0),
            uint16LE(0),
            uint16LE(0),

            uint32LE(
                checksum
            ),

            uint32LE(
                data.length
            ),

            uint32LE(
                data.length
            ),

            uint16LE(
                name.length
            ),

            uint16LE(0),
            uint16LE(0),
            uint16LE(0),
            uint16LE(0),

            uint32LE(0),

            uint32LE(offset),

            name
        );

    central.push(
        centralHeader
    );

    offset +=
        localHeader.length +
        data.length;
}

var localData =
    concatBytes(
        ...local
    );

var centralData =
    concatBytes(
        ...central
    );

var end =
    concatBytes(
        bytes(
            0x50,
            0x4B,
            0x05,
            0x06
        ),

        uint16LE(0),
        uint16LE(0),

        uint16LE(
            files.length
        ),

        uint16LE(
            files.length
        ),

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
```

}

function bytes() {
return new Uint8Array(
Array.from(arguments)
);
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

function concatBytes() {
var arrays =
Array.from(arguments);

```
var length = 0;

for (
    var i = 0;
    i < arrays.length;
    i++
) {
    length +=
        arrays[i].length;
}

var output =
    new Uint8Array(length);

var offset = 0;

for (
    var j = 0;
    j < arrays.length;
    j++
) {
    output.set(
        arrays[j],
        offset
    );

    offset +=
        arrays[j].length;
}

return output;
```

}

window.Genesis2SB3 = {
version: VERSION,

```
getROM: function() {
    return currentROM;
},

getROMData: function() {
    return currentROMData;
},

getROMInfo: function() {
    return currentROMInfo;
},

inspect: function() {
    if (!currentROMData) {
        return null;
    }

    return parseGenesisROM(
        currentROMData
    );
}
```

};

console.log(
"Genesis2SB3 v" +
VERSION +
" ready."
);
