console.log("THE ONE PIECE IS REAL!!!-Whitebeard (Loaded)");

let romData = null;
let romFile = null;

// =========================================================
// ROM LOADING
// =========================================================

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

let generatedSB3 = null;

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function loadROM(file) {
    if (!file) return;

    romFile = file;

    const reader = new FileReader();

    reader.onload = function(event) {
        romData = new Uint8Array(event.target.result);

        romInfo.style.display = "block";

        romName.textContent = file.name;
        romSize.textContent = formatBytes(romData.length);

        romStatus.textContent = "ROM loaded successfully. Ready to compile.";

        compileButton.disabled = false;

        status.textContent = "ROM loaded successfully.";
    };

    reader.onerror = function() {
        romData = null;
        romFile = null;

        romStatus.textContent = "Failed to read ROM.";
        compileButton.disabled = true;
    };

    reader.readAsArrayBuffer(file);
}

romInput.addEventListener("change", function() {
    if (romInput.files.length > 0) {
        loadROM(romInput.files[0]);
    }
});

dropZone.addEventListener("dragover", function(event) {
    event.preventDefault();
    dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", function() {
    dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", function(event) {
    event.preventDefault();
    dropZone.classList.remove("dragover");

    const files = event.dataTransfer.files;

    if (files.length > 0) {
        loadROM(files[0]);
    }
});

dropZone.addEventListener("click", function() {
    romInput.click();
});

removeRom.addEventListener("click", function() {
    romData = null;
    romFile = null;

    romInput.value = "";

    romInfo.style.display = "none";

    compileButton.disabled = true;

    status.textContent = "ROM removed.";
});

// =========================================================
// KNOWN-GOOD PROJECT.JSON FROM v0.4.2
// =========================================================

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
                        name: "Backdrop",
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
                videoState: "off",

                textToSpeechLanguage: null
            }
        ],

        monitors: [],

        extensions: [],

        meta: {
            semver: "3.0.0",
            vm: "11.3.0",
            agent: "Genesis2SB3 v0.5"
        }
    };
}

// =========================================================
// SVG BACKDROP
// =========================================================

function createBackdropSVG() {
    return `<svg xmlns="http://www.w3.org/2000/svg"
width="480"
height="360"
viewBox="0 0 480 360">
<rect width="480" height="360" fill="#ffffff"/>
</svg>`;
}

// =========================================================
// CRC32
// =========================================================

function makeCRC32Table() {
    const table = new Uint32Array(256);

    for (let n = 0; n < 256; n++) {
        let c = n;

        for (let k = 0; k < 8; k++) {
            if (c & 1) {
                c = 0xedb88320 ^ (c >>> 1);
            } else {
                c >>>= 1;
            }
        }

        table[n] = c >>> 0;
    }

    return table;
}

const crcTable = makeCRC32Table();

function crc32(data) {
    let crc = 0xffffffff;

    for (let i = 0; i < data.length; i++) {
        crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    }

    return (crc ^ 0xffffffff) >>> 0;
}

// =========================================================
// ZIP STORE WRITER
// =========================================================

function writeUInt16(arr, offset, value) {
    arr[offset] = value & 0xff;
    arr[offset + 1] = (value >>> 8) & 0xff;
}

function writeUInt32(arr, offset, value) {
    arr[offset] = value & 0xff;
    arr[offset + 1] = (value >>> 8) & 0xff;
    arr[offset + 2] = (value >>> 16) & 0xff;
    arr[offset + 3] = (value >>> 24) & 0xff;
}

function stringToBytes(str) {
    return new TextEncoder().encode(str);
}

function createZip(files) {
    const localParts = [];
    const centralParts = [];

    let offset = 0;

    for (const file of files) {
        const nameBytes = stringToBytes(file.name);
        const data = file.data;

        const crc = crc32(data);
        const size = data.length;

        const localHeader = new Uint8Array(30 + nameBytes.length);

        writeUInt32(localHeader, 0, 0x04034b50);
        writeUInt16(localHeader, 4, 20);
        writeUInt16(localHeader, 6, 0);
        writeUInt16(localHeader, 8, 0);
        writeUInt16(localHeader, 10, 0);
        writeUInt16(localHeader, 12, 0);
        writeUInt32(localHeader, 14, crc);
        writeUInt32(localHeader, 18, size);
        writeUInt32(localHeader, 22, size);
        writeUInt16(localHeader, 26, nameBytes.length);
        writeUInt16(localHeader, 28, 0);

        localHeader.set(nameBytes, 30);

        localParts.push(localHeader);
        localParts.push(data);

        const centralHeader = new Uint8Array(46 + nameBytes.length);

        writeUInt32(centralHeader, 0, 0x02014b50);
        writeUInt16(centralHeader, 4, 20);
        writeUInt16(centralHeader, 6, 20);
        writeUInt16(centralHeader, 8, 0);
        writeUInt16(centralHeader, 10, 0);
        writeUInt16(centralHeader, 12, 0);
        writeUInt16(centralHeader, 14, 0);
        writeUInt32(centralHeader, 16, crc);
        writeUInt32(centralHeader, 20, size);
        writeUInt32(centralHeader, 24, size);
        writeUInt16(centralHeader, 28, nameBytes.length);
        writeUInt16(centralHeader, 30, 0);
        writeUInt16(centralHeader, 32, 0);
        writeUInt16(centralHeader, 34, 0);
        writeUInt16(centralHeader, 36, 0);
        writeUInt32(centralHeader, 38, 0);
        writeUInt32(centralHeader, 42, offset);

        centralHeader.set(nameBytes, 46);

        centralParts.push(centralHeader);

        offset += localHeader.length + data.length;
    }

    let centralSize = 0;

    for (const part of centralParts) {
        centralSize += part.length;
    }

    const centralOffset = offset;

    const end = new Uint8Array(22);

    writeUInt32(end, 0, 0x06054b50);
    writeUInt16(end, 4, 0);
    writeUInt16(end, 6, 0);
    writeUInt16(end, 8, files.length);
    writeUInt16(end, 10, files.length);
    writeUInt32(end, 12, centralSize);
    writeUInt32(end, 16, centralOffset);
    writeUInt16(end, 20, 0);

    const totalSize =
        localParts.reduce((sum, part) => sum + part.length, 0) +
        centralSize +
        end.length;

    const output = new Uint8Array(totalSize);

    let position = 0;

    for (const part of localParts) {
        output.set(part, position);
        position += part.length;
    }

    for (const part of centralParts) {
        output.set(part, position);
        position += part.length;
    }

    output.set(end, position);

    return output;
}

// =========================================================
// COMPILER
// =========================================================

compileButton.addEventListener("click", async function() {
    if (!romData) {
        status.textContent = "Please load a ROM first.";
        return;
    }

    compileButton.disabled = true;

    progressContainer.style.display = "block";
    result.style.display = "none";

    progressBar.style.width = "10%";
    progressText.textContent = "Preparing project...";
    progressPercent.textContent = "10%";

    await new Promise(resolve => setTimeout(resolve, 100));

    progressBar.style.width = "35%";
    progressText.textContent = "Creating project.json...";
    progressPercent.textContent = "35%";

    const projectJSON = JSON.stringify(createProjectJSON());

    await new Promise(resolve => setTimeout(resolve, 100));

    progressBar.style.width = "60%";
    progressText.textContent = "Adding ROM...";
    progressPercent.textContent = "60%";

    /*
     * IMPORTANT:
     *
     * The ROM is deliberately NOT referenced by project.json.
     *
     * This is a packaging experiment to see whether
     * Scratch/TurboWarp accepts an additional file inside
     * the SB3 ZIP.
     */

    await new Promise(resolve => setTimeout(resolve, 100));

    progressBar.style.width = "80%";
    progressText.textContent = "Building SB3...";
    progressPercent.textContent = "80%";

    const files = [
        {
            name: "project.json",
            data: stringToBytes(projectJSON)
        },

        {
            name: "ff3f2e0196df3c7d286c4c13e441b003.svg",
            data: stringToBytes(createBackdropSVG())
        },

        {
            name: "genesis.rom",
            data: romData
        }
    ];

    const zipData = createZip(files);

    generatedSB3 = new Blob(
        [zipData],
        { type: "application/x.scratch.sb3" }
    );

    await new Promise(resolve => setTimeout(resolve, 100));

    progressBar.style.width = "100%";
    progressText.textContent = "Compilation complete!";
    progressPercent.textContent = "100%";

    status.textContent =
        "v0.5 ROM packaging test complete. ROM included as genesis.rom.";

    resultText.textContent =
        "SB3 created successfully. " +
        "The ROM was included inside the SB3 as genesis.rom.";

    result.style.display = "block";

    compileButton.disabled = false;
});

// =========================================================
// DOWNLOAD
// =========================================================

downloadButton.addEventListener("click", function() {
    if (!generatedSB3) return;

    const url = URL.createObjectURL(generatedSB3);

    const a = document.createElement("a");

    a.href = url;
    a.download = "Genesis2SB3-v0.5-rom-test.sb3";

    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 1000);
});
