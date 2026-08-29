const VERSION = "0.1.2";

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


/* =========================================================
   INITIALIZATION
========================================================= */

if (romInput) {
    /*
     * DO NOT filter by extension.
     *
     * Some browsers handle .md strangely because they
     * associate it with Markdown.
     *
     * We want the browser to give us the raw file and
     * we'll determine what it is ourselves.
     */
    romInput.setAttribute("accept", "*/*");
}

if (compileButton) {
    compileButton.disabled = true;
}

console.log(`Genesis2SB3 v${VERSION} loaded.`);


/* =========================================================
   FILE INPUT
========================================================= */

if (romInput) {
    romInput.addEventListener("change", async function(event) {
        const files = event.target.files;

        if (!files || files.length === 0) {
            return;
        }

        const file = files[0];

        console.log("Selected file:", file.name);
        console.log("Size:", file.size);
        console.log("Type:", file.type);

        await loadROM(file);
    });
}


/* =========================================================
   DRAG AND DROP
========================================================= */

if (dropZone) {
    dropZone.addEventListener("dragover", function(event) {
        event.preventDefault();

        dropZone.classList.add("dragging");
    });

    dropZone.addEventListener("dragleave", function() {
        dropZone.classList.remove("dragging");
    });

    dropZone.addEventListener("drop", async function(event) {
        event.preventDefault();

        dropZone.classList.remove("dragging");

        const files = event.dataTransfer.files;

        if (!files || files.length === 0) {
            return;
        }

        const file = files[0];

        console.log("Dropped file:", file.name);

        await loadROM(file);
    });
}


/* =========================================================
   LOAD ROM
========================================================= */

async function loadROM(file) {
    resetCompilation();

    if (!file) {
        return;
    }

    if (file.size === 0) {
        setStatus(
            "The selected file is empty.",
            "error"
        );

        return;
    }

    try {
        setStatus(
            `Reading ${file.name}...`
        );

        /*
         * THIS IS THE IMPORTANT PART.
         *
         * File.arrayBuffer() reads the actual binary
         * bytes regardless of the filename extension
         * or MIME type.
         */
        const rawBuffer = await file.arrayBuffer();

        let data = new Uint8Array(rawBuffer);

        console.log(
            "Raw binary bytes:",
            data.length
        );

        /*
         * Show the first bytes in the console.
         * This is extremely useful for debugging.
         */
        console.log(
            "First 32 bytes:",
            Array.from(
                data.slice(0, 32)
            )
                .map(
                    byte =>
                        byte
                            .toString(16)
                            .padStart(2, "0")
                            .toUpperCase()
                )
                .join(" ")
        );

        /*
         * Detect SMD only from the actual file structure.
         */
        let wasSMD = false;

        if (isDefinitelySMD(data)) {
            console.log(
                "SMD format detected."
            );

            data = deinterleaveSMD(data);

            wasSMD = true;
        }

        /*
         * Now inspect the actual Genesis header.
         */
        const info = parseGenesisROM(data);

        console.log(
            "Genesis ROM information:",
            info
        );

        /*
         * IMPORTANT:
         *
         * We don't care whether the filename ends in
         * .md, .bin, .gen, .smd, or something else.
         *
         * If the bytes contain a valid Genesis header,
         * it's treated as a Genesis ROM.
         */

        if (!info.headerFound) {
            setStatus(
                "This file does not contain a recognizable Sega Genesis header.",
                "error"
            );

            console.warn(
                "No Genesis header found."
            );

            return;
        }

        currentROM = file;
        currentROMData = data;
        currentROMInfo = info;

        displayROMInfo();

        if (wasSMD) {
            setStatus(
                `${info.title || file.name} detected. SMD format converted.`,
                "success"
            );
        } else {
            setStatus(
                `${info.title || file.name} detected as a Sega Genesis ROM.`,
                "success"
            );
        }

        if (compileButton) {
            compileButton.disabled = false;
        }

    } catch (error) {
        console.error(
            "ROM loading error:",
            error
        );

        setStatus(
            `Could not read ROM: ${error.message}`,
            "error"
        );
    }
}


/* =========================================================
   GENESIS HEADER DETECTION
========================================================= */

function findGenesisHeader(data) {
    /*
     * The standard Genesis cartridge header contains
     * "SEGA" at offset 0x100.
     */

    if (
        data.length >= 0x104
    ) {
        const standard =
            readASCII(
                data,
                0x100,
                4
            );

        if (standard === "SEGA") {
            return 0x100;
        }
    }

    /*
     * If it isn't at the standard location, search the
     * entire file for SEGA.
     *
     * This helps with unusual dumps and headers.
     */
    for (
        let offset = 0;
        offset + 4 <= data.length;
        offset++
    ) {
        if (
            data[offset] === 0x53 &&
            data[offset + 1] === 0x45 &&
            data[offset + 2] === 0x47 &&
            data[offset + 3] === 0x41
        ) {
            return offset;
        }
    }

    return -1;
}


/* =========================================================
   GENESIS HEADER PARSER
========================================================= */

function parseGenesisROM(data) {
    const headerOffset =
        findGenesisHeader(data);

    if (headerOffset < 0) {
        return {
            headerFound: false
        };
    }

    const h = headerOffset;

    const info = {
        headerFound: true,

        headerOffset: h,

        console:
            readASCII(
                data,
                h,
                16
            ),

        domesticTitle:
            readASCII(
                data,
                h + 0x20,
                48
            ),

        internationalTitle:
            readASCII(
                data,
                h + 0x50,
                48
            ),

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
                h + 0x7E
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
            read32BE(
                data,
                0
            ),

        resetVector:
            read32BE(
                data,
                4
            )
    };

    info.title =
        info.internationalTitle ||
        info.domesticTitle ||
        "Untitled Genesis ROM";

    info.calculatedChecksum =
        calculateGenesisChecksum(data);

    info.checksumMatches =
        info.calculatedChecksum ===
        info.checksum;

    return info;
}


/* =========================================================
   BINARY READERS
========================================================= */

function read16BE(data, offset) {
    if (
        offset < 0 ||
        offset + 1 >= data.length
    ) {
        return 0;
    }

    return (
        (data[offset] << 8) |
        data[offset + 1]
    ) >>> 0;
}

function read32BE(data, offset) {
    if (
        offset < 0 ||
        offset + 3 >= data.length
    ) {
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
    let result = "";

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
            result +=
                String.fromCharCode(
                    value
                );
        } else {
            result += " ";
        }
    }

    return result
        .replace(/\s+/g, " ")
        .trim();
}


/* =========================================================
   CHECKSUM
========================================================= */

function calculateGenesisChecksum(data) {
    const header =
        findGenesisHeader(data);

    let start = 0x200;
    let end = data.length - 1;

    if (header >= 0) {
        const headerStart =
            read32BE(
                data,
                header + 0x80
            );

        const headerEnd =
            read32BE(
                data,
                header + 0x84
            );

        if (
            headerStart >= 0 &&
            headerStart < data.length
        ) {
            start = headerStart;
        }

        if (
            headerEnd >= start &&
            headerEnd < data.length
        ) {
            end = headerEnd;
        }
    }

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
}


/* =========================================================
   SMD DETECTION
========================================================= */

function isDefinitelySMD(data) {
    if (
        data.length <
        512 + 16384
    ) {
        return false;
    }

    if (
        (data.length - 512) %
        16384 !== 0
    ) {
        return false;
    }

    /*
     * Typical SMD header signature.
     */
    if (
        data[0] !== 0x03 ||
        data[1] !== 0x00
    ) {
        return false;
    }

    return true;
}


/* =========================================================
   SMD DEINTERLEAVING
========================================================= */

function deinterleaveSMD(data) {
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

        const half =
            Math.floor(
                blockSize / 2
            );

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
    }

    return output;
}


/* =========================================================
   DISPLAY ROM
========================================================= */

function displayROMInfo() {
    if (romInfo) {
        romInfo.classList.remove(
            "hidden"
        );
    }

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
            "Genesis ROM detected";
    }

    if (dropZone) {
        dropZone.classList.add(
            "has-rom"
        );
    }
}


/* =========================================================
   FORMAT BYTES
========================================================= */

function formatBytes(bytes) {
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1048576) {
        return `${(
            bytes / 1024
        ).toFixed(2)} KB`;
    }

    return `${(
        bytes / 1048576
    ).toFixed(2)} MB`;
}


/* =========================================================
   COMPILER
========================================================= */

if (compileButton) {
    compileButton.addEventListener(
        "click",
        async function() {
            if (!currentROMData) {
                setStatus(
                    "Select a Genesis ROM first.",
                    "error"
                );

                return;
            }

            compileButton.disabled = true;

            if (progressContainer) {
                progressContainer.classList.remove(
                    "hidden"
                );
            }

            try {
                await compileROM();

                setStatus(
                    "ROM analysis complete.",
                    "success"
                );

            } catch (error) {
                console.error(
                    error
                );

                setStatus(
                    `Compilation failed: ${error.message}`,
                    "error"
                );
            }

            compileButton.disabled = false;
        }
    );
}


/* =========================================================
   COMPILE ROM
========================================================= */

async function compileROM() {
    setProgress(
        10,
        "Reading Genesis cartridge..."
    );

    await delay(50);

    const info =
        parseGenesisROM(
            currentROMData
        );

    if (!info.headerFound) {
        throw new Error(
            "Genesis header not found."
        );
    }

    setProgress(
        30,
        "Reading 68000 reset vector..."
    );

    await delay(50);

    console.log(
        "Initial stack pointer:",
        formatHex(info.initialSP)
    );

    console.log(
        "Reset vector:",
        formatHex(info.resetVector)
    );

    setProgress(
        50,
        "Analyzing ROM..."
    );

    await delay(50);

    const instructionCount =
        Math.floor(
            currentROMData.length / 2
        );

    setProgress(
        70,
        "Building Scratch project..."
    );

    await delay(50);

    const project =
        createScratchProject(
            info,
            instructionCount
        );

    setProgress(
        85,
        "Encoding project..."
    );

    await delay(50);

    const projectJSON =
        JSON.stringify(
            project,
            null,
            2
        );

    const projectBytes =
        new TextEncoder().encode(
            projectJSON
        );

    setProgress(
        100,
        "Compilation complete."
    );

    generatedSB3 =
        new Blob(
            [
                createStoredZip([
                    {
                        name:
                            "project.json",
                        data:
                            projectBytes
                    }
                ])
            ],
            {
                type:
                    "application/x.scratch.sb3"
            }
        );

    if (result) {
        result.classList.remove(
            "hidden"
        );
    }

    if (resultText) {
        resultText.textContent =
            `${info.title} loaded successfully. ` +
            `ROM size: ${formatBytes(currentROMData.length)}. ` +
            `Reset vector: ${formatHex(info.resetVector)}.`;
    }
}


/* =========================================================
   SCRATCH PROJECT
========================================================= */

function createScratchProject(
    info,
    instructionCount
) {
    return {
        targets: [
            {
                isStage: true,
                name: "Genesis2SB3",

                variables: {
                    rom_size: [
                        "ROM Size",
                        currentROMData.length
                    ],

                    reset_vector: [
                        "Reset Vector",
                        info.resetVector
                    ]
                },

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
            }
        ],

        monitors: [],
        extensions: [],

        meta: {
            semver: "3.0.0",
            vm: "0.2.0",
            agent:
                `Genesis2SB3/${VERSION}`
        },

        genesis2sb3: {
            version: VERSION,

            title: info.title,

            console: info.console,

            serial: info.serial,

            region: info.region,

            romSize:
                currentROMData.length,

            instructionWords:
                instructionCount,

            resetVector:
                info.resetVector
        }
    };
}


/* =========================================================
   PROGRESS
========================================================= */

function setProgress(percent, text) {
    if (progressBar) {
        progressBar.style.width =
            `${percent}%`;
    }

    if (progressPercent) {
        progressPercent.textContent =
            `${percent}%`;
    }

    if (progressText) {
        progressText.textContent =
            text;
    }
}


/* =========================================================
   STATUS
========================================================= */

function setStatus(message, type = "") {
    if (!status) {
        return;
    }

    status.textContent =
        message;

    status.className =
        "status";

    if (type) {
        status.classList.add(
            type
        );
    }
}


/* =========================================================
   RESET
========================================================= */

function resetCompilation() {
    generatedSB3 = null;

    if (result) {
        result.classList.add(
            "hidden"
        );
    }

    if (progressContainer) {
        progressContainer.classList.add(
            "hidden"
        );
    }
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
        romInfo.classList.add(
            "hidden"
        );
    }

    if (result) {
        result.classList.add(
            "hidden"
        );
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
}

if (removeRom) {
    removeRom.addEventListener(
        "click",
        resetROM
    );
}


/* =========================================================
   DOWNLOAD
========================================================= */

if (downloadButton) {
    downloadButton.addEventListener(
        "click",
        function() {
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
                "-Genesis2SB3.sb3";

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
                function() {
                    URL.revokeObjectURL(
                        url
                    );
                },
                1000
            );
        }
    );
}


/* =========================================================
   ZIP
========================================================= */

function createStoredZip(files) {
    const localParts = [];
    const centralParts = [];

    let offset = 0;

    for (const file of files) {
        const name =
            new TextEncoder().encode(
                file.name
            );

        const data =
            file.data;

        const checksum =
            crc32(data);

        const local =
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
            local,
            data
        );

        const central =
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
            central
        );

        offset +=
            local.length +
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

    const end =
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
        end
    );
}


/* =========================================================
   CRC32
========================================================= */

const CRC_TABLE =
    new Uint32Array(256);

for (
    let i = 0;
    i < 256;
    i++
) {
    let c = i;

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
}

function crc32(data) {
    let crc =
        0xFFFFFFFF;

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
        crc ^
        0xFFFFFFFF
    ) >>> 0;
}


/* =========================================================
   ZIP HELPERS
========================================================= */

function concatBytes(...arrays) {
    let total = 0;

    for (const array of arrays) {
        total += array.length;
    }

    const output =
        new Uint8Array(total);

    let offset = 0;

    for (const array of arrays) {
        output.set(
            array,
            offset
        );

        offset +=
            array.length;
    }

    return output;
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


/* =========================================================
   MISC
========================================================= */

function delay(ms) {
    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                ms
            )
    );
}


/* =========================================================
   DEBUG API
========================================================= */

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
    "Genesis2SB3 is ready."
);
console.log(
    "Files are inspected as raw binary data."
);
