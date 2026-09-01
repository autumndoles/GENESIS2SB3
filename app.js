/*
    Genesis2SB3
    v0.5.1

    ROM-in-SB3 test
    - Known-good Scratch project structure
    - Valid SVG backdrop
    - Adds the Genesis ROM to the SB3 ZIP
    - Does NOT generate an emulator yet
*/

console.log("THE ONE PIECE IS REAL!!!-Whitebeard (Loaded)");

/* =========================================================
   ELEMENTS
========================================================= */

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
   STATE
========================================================= */

let selectedROM = null;
let generatedSB3 = null;

/* =========================================================
   HELPERS
========================================================= */

function setProgress(percent, text) {
    const value = Math.max(0, Math.min(100, percent));

    progressBar.style.width = `${value}%`;
    progressPercent.textContent = `${value}%`;
    progressText.textContent = text;
}

function setStatus(message) {
    status.textContent = message;
}

function formatBytes(bytes) {
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(2)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/* =========================================================
   ROM LOADING
========================================================= */

function loadROM(file) {
    if (!file) {
        return;
    }

    selectedROM = file;

    romName.textContent = file.name;
    romSize.textContent = formatBytes(file.size);

    romStatus.textContent = "ROM selected";

    romInfo.classList.remove("hidden");

    compileButton.disabled = false;

    setStatus("ROM loaded successfully. Ready to compile.");

    // Hide old result if another ROM is selected.
    result.classList.add("hidden");

    generatedSB3 = null;
}

romInput.addEventListener("change", () => {
    const file = romInput.files[0];

    if (file) {
        loadROM(file);
    }
});

/* =========================================================
   DRAG AND DROP
========================================================= */

dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropZone.classList.add("drag-over");
});

dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("drag-over");
});

dropZone.addEventListener("drop", (event) => {
    event.preventDefault();

    dropZone.classList.remove("drag-over");

    const file = event.dataTransfer.files[0];

    if (file) {
        loadROM(file);
    }
});

/* =========================================================
   REMOVE ROM
========================================================= */

removeRom.addEventListener("click", () => {
    selectedROM = null;
    generatedSB3 = null;

    romInput.value = "";

    romInfo.classList.add("hidden");

    romName.textContent = "—";
    romSize.textContent = "—";

    romStatus.textContent = "No ROM selected";

    compileButton.disabled = true;

    result.classList.add("hidden");

    progressContainer.classList.add("hidden");

    setStatus("Select a Genesis ROM to begin.");
});

/* =========================================================
   CRC32
========================================================= */

function makeCRC32Table() {
    const table = new Uint32Array(256);

    for (let n = 0; n < 256; n++) {
        let c = n;

        for (let k = 0; k < 8; k++) {
            c = (c & 1)
                ? 0xEDB88320 ^ (c >>> 1)
                : c >>> 1;
        }

        table[n] = c >>> 0;
    }

    return table;
}

const crcTable = makeCRC32Table();

function crc32(data) {
    let crc = 0xFFFFFFFF;

    for (let i = 0; i < data.length; i++) {
        crc =
            crcTable[(crc ^ data[i]) & 0xFF] ^
            (crc >>> 8);
    }

    return (crc ^ 0xFFFFFFFF) >>> 0;
}

/* =========================================================
   ZIP HELPERS
========================================================= */

function writeUInt16LE(array, offset, value) {
    array[offset] = value & 0xFF;
    array[offset + 1] = (value >>> 8) & 0xFF;
}

function writeUInt32LE(array, offset, value) {
    array[offset] = value & 0xFF;
    array[offset + 1] = (value >>> 8) & 0xFF;
    array[offset + 2] = (value >>> 16) & 0xFF;
    array[offset + 3] = (value >>> 24) & 0xFF;
}

function concatUint8Arrays(arrays) {
    let total = 0;

    for (const array of arrays) {
        total += array.length;
    }

    const result = new Uint8Array(total);

    let offset = 0;

    for (const array of arrays) {
        result.set(array, offset);
        offset += array.length;
    }

    return result;
}

function createZip(files) {
    const encoder = new TextEncoder();

    const localParts = [];
    const centralParts = [];

    let offset = 0;

    for (const file of files) {
        const nameBytes = encoder.encode(file.name);
        const data = file.data;

        const crc = crc32(data);

        /* Local file header */

        const localHeader = new Uint8Array(30 + nameBytes.length);

        writeUInt32LE(localHeader, 0, 0x04034B50);
        writeUInt16LE(localHeader, 4, 20);
        writeUInt16LE(localHeader, 6, 0);
        writeUInt16LE(localHeader, 8, 0);
        writeUInt16LE(localHeader, 10, 0);
        writeUInt16LE(localHeader, 12, 0);

        writeUInt32LE(localHeader, 14, crc);
        writeUInt32LE(localHeader, 18, data.length);
        writeUInt32LE(localHeader, 22, data.length);

        writeUInt16LE(localHeader, 26, nameBytes.length);
        writeUInt16LE(localHeader, 28, 0);

        localHeader.set(nameBytes, 30);

        localParts.push(localHeader);
        localParts.push(data);

        /* Central directory entry */

        const centralHeader = new Uint8Array(46 + nameBytes.length);

        writeUInt32LE(centralHeader, 0, 0x02014B50);
        writeUInt16LE(centralHeader, 4, 20);
        writeUInt16LE(centralHeader, 6, 20);
        writeUInt16LE(centralHeader, 8, 0);
        writeUInt16LE(centralHeader, 10, 0);
        writeUInt16LE(centralHeader, 12, 0);
        writeUInt16LE(centralHeader, 14, 0);

        writeUInt32LE(centralHeader, 16, crc);
        writeUInt32LE(centralHeader, 20, data.length);
        writeUInt32LE(centralHeader, 24, data.length);

        writeUInt16LE(centralHeader, 28, nameBytes.length);
        writeUInt16LE(centralHeader, 30, 0);
        writeUInt16LE(centralHeader, 32, 0);

        writeUInt16LE(centralHeader, 34, 0);
        writeUInt16LE(centralHeader, 36, 0);

        writeUInt32LE(centralHeader, 38, 0);
        writeUInt32LE(centralHeader, 42, offset);

        centralHeader.set(nameBytes, 46);

        centralParts.push(centralHeader);

        offset += localHeader.length + data.length;
    }

    const centralDirectoryOffset = offset;

    const centralDirectory = concatUint8Arrays(centralParts);

    const end = new Uint8Array(22);

    writeUInt32LE(end, 0, 0x06054B50);
    writeUInt16LE(end, 4, 0);
    writeUInt16LE(end, 6, 0);
    writeUInt16LE(end, 8, files.length);
    writeUInt16LE(end, 10, files.length);

    writeUInt32LE(end, 12, centralDirectory.length);
    writeUInt32LE(end, 16, centralDirectoryOffset);

    writeUInt16LE(end, 20, 0);

    return concatUint8Arrays([
        ...localParts,
        centralDirectory,
        end
    ]);
}

/* =========================================================
   SCRATCH PROJECT
========================================================= */

function createProjectJSON() {
    return {
        targets: [
            {
                isStage: true,
                name: "Stage",

                variables: {},
                lists: {},
                broadcasts: {},
                blocks: {},
                comments: {},

                currentCostume: 0,

                costumes: [
                    {
                        assetId: "ff3f2e0196df3c7d286c4c13e441b003",
                        name: "backdrop1",
                        md5ext: "ff3f2e0196df3c7d286c4c13e441b003.svg",
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
            }
        ],

        monitors: [],

        extensions: [],

        meta: {
            semver: "3.0.0",
            vm: "11.3.0",
            agent: "Genesis2SB3"
        }
    };
}

/* =========================================================
   SVG BACKDROP
========================================================= */

function createBackdropSVG() {
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg"
     width="480"
     height="360"
     viewBox="0 0 480 360">
    <rect width="480" height="360" fill="#ffffff"/>
</svg>
`;

    return new TextEncoder().encode(svg);
}

/* =========================================================
   COMPILER
========================================================= */

async function compileROM() {
    if (!selectedROM) {
        setStatus("Please select a Genesis ROM first.");
        return;
    }

    compileButton.disabled = true;

    result.classList.add("hidden");

    progressContainer.classList.remove("hidden");

    setProgress(0, "Preparing compiler...");

    await new Promise(resolve => setTimeout(resolve, 150));

    try {
        setProgress(20, "Reading ROM...");

        const romData = new Uint8Array(
            await selectedROM.arrayBuffer()
        );

        await new Promise(resolve => setTimeout(resolve, 150));

        setProgress(45, "Building Scratch project...");

        const projectJSON = JSON.stringify(
            createProjectJSON()
        );

        const projectData =
            new TextEncoder().encode(projectJSON);

        await new Promise(resolve => setTimeout(resolve, 150));

        setProgress(65, "Adding backdrop...");

        const backdrop = createBackdropSVG();

        await new Promise(resolve => setTimeout(resolve, 150));

        setProgress(80, "Adding ROM data...");

        const files = [
            {
                name: "project.json",
                data: projectData
            },

            {
                name: "ff3f2e0196df3c7d286c4c13e441b003.svg",
                data: backdrop
            },

            {
                name: "genesis.rom",
                data: romData
            }
        ];

        setProgress(90, "Creating SB3 archive...");

        const zipData = createZip(files);

        generatedSB3 = new Blob(
            [zipData],
            {
                type: "application/x.scratch.sb3"
            }
        );

        await new Promise(resolve => setTimeout(resolve, 150));

        setProgress(100, "Compilation complete!");

        setStatus(
            "ROM compiled successfully. SB3 is ready."
        );

        resultText.textContent =
            `Created a Scratch project containing ${selectedROM.name}.`;

        /*
            IMPORTANT:
            Remove the hidden class from the RESULT PANEL itself.
            This is more reliable than only changing style.display.
        */

        result.classList.remove("hidden");

        /*
            Also explicitly make sure the button isn't hidden.
        */

        downloadButton.classList.remove("hidden");
        downloadButton.style.display = "inline-block";
        downloadButton.disabled = false;

        console.log(
            "SB3 generated:",
            generatedSB3.size,
            "bytes"
        );

    } catch (error) {
        console.error("Compilation failed:", error);

        setStatus(
            "Compilation failed: " + error.message
        );

        result.classList.add("hidden");

    } finally {
        compileButton.disabled = false;
    }
}

/* =========================================================
   COMPILE BUTTON
========================================================= */

compileButton.addEventListener("click", compileROM);

/* =========================================================
   DOWNLOAD
========================================================= */

downloadButton.addEventListener("click", () => {
    if (!generatedSB3) {
        setStatus("No SB3 project has been generated yet.");
        return;
    }

    const url = URL.createObjectURL(generatedSB3);

    const link = document.createElement("a");

    link.href = url;
    link.download = "Genesis2SB3-v0.5.1-rom-test.sb3";

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 1000);

    console.log("SB3 download started.");
});

/* =========================================================
   INITIAL STATE
========================================================= */

result.classList.add("hidden");
progressContainer.classList.add("hidden");

downloadButton.disabled = false;
