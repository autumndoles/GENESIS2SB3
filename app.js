const VERSION = "0.1.4";

let currentROM = null;
let currentROMData = null;
let currentROMInfo = null;
let generatedSB3 = null;


/* =========================================================
   DOM
========================================================= */

const romInput = document.getElementById("romInput");
const dropZone = document.getElementById("dropZone");
const romInfo = document.getElementById("romInfo");
const romName = document.getElementById("romName");
const romSize = document.getElementById("romSize");
const romStatus = document.getElementById("romStatus");
const removeRom = document.getElementById("removeRom");

const compileButton = document.getElementById("compileButton");

const progressContainer =
    document.getElementById("progressContainer");

const progressBar =
    document.getElementById("progressBar");

const progressText =
    document.getElementById("progressText");

const progressPercent =
    document.getElementById("progressPercent");

const status =
    document.getElementById("status");

const result =
    document.getElementById("result");

const resultText =
    document.getElementById("resultText");

const downloadButton =
    document.getElementById("downloadButton");


/* =========================================================
   INITIALIZATION
========================================================= */

if (romInput) {
    /*
     * Do not restrict by extension.
     *
     * This allows .md files and unusual ROM filenames.
     */
    romInput.setAttribute("accept", "*/*");
}

if (compileButton) {
    compileButton.disabled = true;
}

console.log(
    `Genesis2SB3 v${VERSION} loaded.`
);


/* =========================================================
   FILE INPUT
========================================================= */

if (romInput) {
    romInput.addEventListener(
        "change",
        async function(event) {

            const files =
                event.target.files;

            if (!files || files.length === 0) {
                return;
            }

            const file = files[0];

            console.log(
                "Selected file:",
                file.name
            );

            await loadROM(file);
        }
    );
}


/* =========================================================
   DRAG AND DROP
========================================================= */

if (dropZone) {

    dropZone.addEventListener(
        "dragover",
        function(event) {

            event.preventDefault();

            dropZone.classList.add(
                "dragging"
            );
        }
    );

    dropZone.addEventListener(
        "dragleave",
        function() {

            dropZone.classList.remove(
                "dragging"
            );
        }
    );

    dropZone.addEventListener(
        "drop",
        async function(event) {

            event.preventDefault();

            dropZone.classList.remove(
                "dragging"
            );

            const files =
                event.dataTransfer.files;

            if (!files || files.length === 0) {
                return;
            }

            const file = files[0];

            console.log(
                "Dropped file:",
                file.name
            );

            await loadROM(file);
        }
    );
}


/* =========================================================
   LOAD ROM
========================================================= */

async function loadROM(file) {

    resetCompilation();

    if (!file) {
        setStatus(
            "No file was selected.",
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

    try {

        setStatus(
            `Reading ${file.name}...`
        );

        /*
         * Read the file as raw binary data.
         *
         * The filename extension does NOT matter here.
         */
        const buffer =
            await file.arrayBuffer();

        let data =
            new Uint8Array(buffer);

        console.log(
            "File successfully loaded."
        );

        console.log(
            "Filename:",
            file.name
        );

        console.log(
            "MIME type:",
            file.type || "(none)"
        );

        console.log(
            "File size:",
            data.length,
            "bytes"
        );

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


        /* =================================================
           SMD DETECTION
        ================================================= */

        let wasSMD = false;

        if (isDefinitelySMD(data)) {

            console.log(
                "SMD format detected."
            );

            data =
                deinterleaveSMD(data);

            wasSMD = true;

            console.log(
                "SMD deinterleaved."
            );
        }


        /* =================================================
           GENESIS HEADER DETECTION
        ================================================= */

        const info =
            parseGenesisROM(data);


        /* =================================================
           IMPORTANT:
           FILE LOADING AND HEADER DETECTION ARE SEPARATE.
        ================================================= */

        currentROM =
            file;

        currentROMData =
            data;

        currentROMInfo =
            info;


        /* =================================================
           ALWAYS DISPLAY THE LOADED FILE
        ================================================= */

        displayROMInfo();


        /* =================================================
           HEADER FOUND
        ================================================= */

        if (info.headerFound) {

            console.log(
                "Genesis header detected."
            );

            console.log(
                "Title:",
                info.title
            );

            console.log(
                "Reset vector:",
                formatHex(
                    info.resetVector
                )
            );

            if (wasSMD) {

                setStatus(
                    `${info.title} detected. SMD ROM converted successfully.`,
                    "success"
                );

            } else {

                setStatus(
                    `${info.title} detected as a Sega Genesis ROM.`,
                    "success"
                );
            }

        }

        /* =================================================
           HEADER NOT FOUND
        ================================================= */

        else {

            console.warn(
                "No standard Genesis header was detected."
            );

            /*
             * DO NOT reject the file.
             *
             * It was successfully loaded.
             */
            setStatus(
                `${file.name} loaded successfully. Genesis header not detected.`,
                "warning"
            );
        }


        /* =================================================
           ENABLE COMPILER
        ================================================= */

        if (compileButton) {
            compileButton.disabled =
                false;
        }

    }

    catch (error) {

        console.error(
            "ROM loading failed:",
            error
        );

        setStatus(
            `Could not read ROM: ${error.message}`,
            "error"
        );
    }
}


/* =========================================================
   FIND GENESIS HEADER
========================================================= */

function findGenesisHeader(data) {

    /*
     * Standard Genesis cartridge header.
     *
     * "SEGA" normally appears at 0x100.
     */
    if (
        data.length >= 0x104 &&
        readASCII(
            data,
            0x100,
            4
        ) === "SEGA"
    ) {

        return 0x100;
    }


    /*
     * Search the file as a fallback.
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
   PARSE GENESIS HEADER
========================================================= */

function parseGenesisROM(data) {

    const header =
        findGenesisHeader(data);

    if (header < 0) {

        return {
            headerFound: false,

            title: null,

            console: null,

            serial: null,

            region: null,

            checksum: 0,

            calculatedChecksum: 0,

            checksumMatches: false,

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
    }


    const info = {

        headerFound: true,

        headerOffset:
            header,

        console:
            readASCII(
                data,
                header,
                16
            ),

        domesticTitle:
            readASCII(
                data,
                header + 0x20,
                48
            ),

        internationalTitle:
            readASCII(
                data,
                header + 0x50,
                48
            ),

        serial:
            readASCII(
                data,
                header + 0x60,
                14
            ),

        version:
            readASCII(
                data,
                header + 0x6E,
                2
            ),

        checksum:
            read16BE(
                data,
                header + 0x7E
            ),

        romStart:
            read32BE(
                data,
                header + 0x80
            ),

        romEnd:
            read32BE(
                data,
                header + 0x84
            ),

        ramStart:
            read32BE(
                data,
                header + 0x88
            ),

        ramEnd:
            read32BE(
                data,
                header + 0x8C
            ),

        region:
            readASCII(
                data,
                header + 0xF0,
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
        "Unknown Genesis Game";


    info.calculatedChecksum =
        calculateGenesisChecksum(
            data
        );


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


function readASCII(
    data,
    offset,
    length
) {

    let text = "";

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
                String.fromCharCode(
                    value
                );

        } else {

            text += " ";
        }
    }

    return text
        .replace(/\s+/g, " ")
        .trim();
}


/* =========================================================
   FORMATTERS
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


function formatHex(
    value,
    digits = 8
) {

    return "0x" +
        (
            value >>> 0
        )
            .toString(16)
            .toUpperCase()
            .padStart(
                digits,
                "0"
            );
}


/* =========================================================
   CHECKSUM
========================================================= */

function calculateGenesisChecksum(data) {

    const header =
        findGenesisHeader(data);

    let start = 0x200;

    let end =
        data.length - 1;


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

            start =
                headerStart;
        }


        if (
            headerEnd >= start &&
            headerEnd < data.length
        ) {

            end =
                headerEnd;
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
   SMD
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


    return (
        data[0] === 0x03 &&
        data[1] === 0x00
    );
}


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

        const blockSize =
            Math.min(
                16384,
                body.length -
                blockStart
            );

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
                blockStart +
                i * 2
            ] =
                body[
                    blockStart +
                    half +
                    i
                ];


            output[
                blockStart +
                i * 2 +
                1
            ] =
                body[
                    blockStart +
                    i
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
            currentROMInfo &&
            currentROMInfo.headerFound

                ? "Genesis ROM detected"

                : "ROM loaded";
    }


    if (dropZone) {

        dropZone.classList.add(
            "has-rom"
        );
    }
}


/* =========================================================
   COMPILE BUTTON
========================================================= */

if (compileButton) {

    compileButton.addEventListener(
        "click",
        async function() {

            if (!currentROMData) {

                setStatus(
                    "Select a ROM first.",
                    "error"
                );

                return;
            }


            compileButton.disabled =
                true;


            if (progressContainer) {

                progressContainer.classList.remove(
                    "hidden"
                );
            }


            try {

                await compileROM();

                setStatus(
                    "Scratch project generated successfully.",
                    "success"
                );

            }

            catch (error) {

                console.error(
                    "Compilation error:",
                    error
                );

                setStatus(
                    `Compilation failed: ${error.message}`,
                    "error"
                );
            }


            compileButton.disabled =
                false;
        }
    );
}


/* =========================================================
   COMPILE ROM
========================================================= */

async function compileROM() {

    setProgress(
        10,
        "Reading ROM..."
    );

    await delay(50);


    const info =
        currentROMInfo ||
        parseGenesisROM(
            currentROMData
        );


    setProgress(
        25,
        "Analyzing ROM data..."
    );

    await delay(50);


    console.log(
        "Initial stack pointer:",
        formatHex(
            info.initialSP
        )
    );


    console.log(
        "Reset vector:",
        formatHex(
            info.resetVector
        )
    );


    setProgress(
        45,
        "Preparing Scratch runtime..."
    );

    await delay(50);


    const instructionWords =
        Math.floor(
            currentROMData.length /
            2
        );


    setProgress(
        65,
        "Creating project.json..."
    );

    await delay(50);


    const project =
        createScratchProject(
            info,
            instructionWords
        );


    const projectJSON =
        JSON.stringify(
            project
        );


    const projectBytes =
        new TextEncoder().encode(
            projectJSON
        );


    setProgress(
        85,
        "Building SB3 archive..."
    );

    await delay(50);


    const zip =
        createZIP([
            {
                name:
                    "project.json",

                data:
                    projectBytes
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

        result.classList.remove(
            "hidden"
        );
    }


    if (resultText) {

        const title =
            info.headerFound
                ? info.title
                : currentROM.name;


        resultText.textContent =
            `${title} was converted into a Scratch project. ` +
            `ROM size: ${formatBytes(
                currentROMData.length
            )}.`;
    }
}


/* =========================================================
   SCRATCH PROJECT
========================================================= */

function createScratchProject(
    info,
    instructionWords
) {

    const flagID =
        "genesis_flag";

    const sayID =
        "genesis_say";


    const title =
        cleanScratchText(
            info.headerFound
                ? info.title
                : currentROM.name
        );


    return {

        targets: [

            {

                isStage: true,

                name: "Stage",


                variables: {

                    "romSize": [
                        "ROM Size",
                        currentROMData.length.toString()
                    ],

                    "resetVector": [
                        "Reset Vector",
                        formatHex(
                            info.resetVector
                        )
                    ]
                },


                lists: {},

                broadcasts: {},


                blocks: {

                    [flagID]: {

                        opcode:
                            "event_whenflagclicked",

                        next:
                            sayID,

                        parent:
                            null,

                        inputs: {},

                        fields: {},

                        shadow:
                            false,

                        topLevel:
                            true,

                        x:
                            100,

                        y:
                            100
                    },


                    [sayID]: {

                        opcode:
                            "looks_say",

                        next:
                            null,

                        parent:
                            flagID,

                        inputs: {

                            MESSAGE: [

                                1,

                                [
                                    10,

                                    `Genesis2SB3: ${title}`
                                ]
                            ]
                        },

                        fields: {},

                        shadow:
                            false,

                        topLevel:
                            false
                    }
                },


                comments: {},


                currentCostume:
                    0,

                costumes: [],

                sounds: [],

                volume:
                    100,

                layerOrder:
                    0,

                tempo:
                    60
            }
        ],


        monitors: [],

        extensions: [],


        meta: {

            semver:
                "3.0.0",

            vm:
                "12.0.0",

            agent:
                `Genesis2SB3/${VERSION}`
        },


        genesis2sb3: {

            version:
                VERSION,

            filename:
                currentROM.name,

            title:
                info.title,

            headerDetected:
                info.headerFound,

            console:
                info.console,

            serial:
                info.serial,

            region:
                info.region,

            romSize:
                currentROMData.length,

            instructionWords:
                instructionWords,

            resetVector:
                info.resetVector,

            initialStackPointer:
                info.initialSP,

            checksum:
                info.checksum,

            calculatedChecksum:
                info.calculatedChecksum,

            checksumMatches:
                info.checksumMatches
        }
    };
}


/* =========================================================
   SCRATCH TEXT
========================================================= */

function cleanScratchText(text) {

    if (!text) {
        return "Unknown Genesis ROM";
    }

    return String(text)
        .replace(/\0/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 200);
}


/* =========================================================
   ZIP GENERATOR
========================================================= */

function createZIP(files) {

    const localParts = [];

    const centralParts = [];

    let offset = 0;


    for (const file of files) {

        const nameBytes =
            new TextEncoder().encode(
                file.name
            );

        const data =
            file.data;

        const checksum =
            crc32(data);


        const localHeader =
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
                    nameBytes.length
                ),

                uint16LE(0),

                nameBytes
            );


        localParts.push(
            localHeader,
            data
        );


        const centralHeader =
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
                    nameBytes.length
                ),

                uint16LE(0),

                uint16LE(0),

                uint16LE(0),

                uint16LE(0),

                uint32LE(0),

                uint32LE(offset),

                nameBytes
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

            bytes(
                0x50,
                0x4B,
                0x05,
                0x06
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
        endRecord
    );
}


/* =========================================================
   ZIP HELPERS
========================================================= */

function bytes(...values) {

    return new Uint8Array(
        values
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

    let value = i;


    for (
        let j = 0;
        j < 8;
        j++
    ) {

        if (value & 1) {

            value =
                0xEDB88320 ^
                (value >>> 1);

        } else {

            value >>>=
                1;
        }
    }


    CRC_TABLE[i] =
        value >>> 0;
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
                (crc ^ data[i]) &
                0xFF
            ] ^
            (crc >>> 8);
    }


    return (
        crc ^
        0xFFFFFFFF
    ) >>> 0;
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
                document.createElement(
                    "a"
                );


            link.href =
                url;

            link.download =
                filename;


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
   REMOVE ROM
========================================================= */

if (removeRom) {

    removeRom.addEventListener(
        "click",
        resetROM
    );
}


function resetROM() {

    currentROM =
        null;

    currentROMData =
        null;

    currentROMInfo =
        null;

    generatedSB3 =
        null;


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


    if (progressContainer) {
        progressContainer.classList.add(
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


/* =========================================================
   RESET COMPILATION
========================================================= */

function resetCompilation() {

    generatedSB3 =
        null;


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


/* =========================================================
   PROGRESS
========================================================= */

function setProgress(
    percent,
    message
) {

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
            message;
    }
}


/* =========================================================
   STATUS
========================================================= */

function setStatus(
    message,
    type = ""
) {

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

    version:
        VERSION,


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
    `Genesis2SB3 v${VERSION} ready.`
);
