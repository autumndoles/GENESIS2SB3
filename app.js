/* =========================================================
   Genesis2SB3
   v0.5.2
   ROM-in-SB3 baseline
   ========================================================= */

"use strict";

console.log("THE ONE PIECE IS REAL!!!-Whitebeard (Loaded)");

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

let loadedROM = null;
let generatedSB3 = null;

/* =========================================================
   SAFETY CHECK
   ========================================================= */

const requiredElements = {
    romInput,
    dropZone,
    romInfo,
    romName,
    romSize,
    romStatus,
    removeRom,
    compileButton,
    progressContainer,
    progressBar,
    progressText,
    progressPercent,
    status,
    result,
    resultText,
    downloadButton
};

for (const [name, element] of Object.entries(requiredElements)) {
    if (!element) {
        console.error(`Genesis2SB3: Missing HTML element: ${name}`);
    }
}

/* =========================================================
   HELPERS
   ========================================================= */

function formatBytes(bytes) {
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(2)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function setStatus(message, type = "") {
    if (!status) return;

    status.textContent = message;
    status.className = "status";

    if (type) {
        status.classList.add(type);
    }
}

function setProgress(percent, message) {
    const value = Math.max(0, Math.min(100, percent));

    if (progressBar) {
        progressBar.style.width = `${value}%`;
    }

    if (progressPercent) {
        progressPercent.textContent = `${Math.round(value)}%`;
    }

    if (progressText) {
        progressText.textContent = message;
    }
}

function show(element) {
    if (!element) return;

    element.classList.remove("hidden");
}

function hide(element) {
    if (!element) return;

    element.classList.add("hidden");
}

/* =========================================================
   ROM LOADING
   ========================================================= */

function handleROM(file) {
    if (!file) {
        return;
    }

    try {
        loadedROM = file;

        if (romName) {
            romName.textContent = file.name;
        }

        if (romSize) {
            romSize.textContent = formatBytes(file.size);
        }

        if (romStatus) {
            romStatus.textContent = "ROM loaded successfully";
        }

        show(romInfo);

        setStatus(
            "ROM loaded successfully. Ready to compile.",
            "success"
        );

        if (compileButton) {
            compileButton.disabled = false;
        }

        console.log("ROM loaded:", file.name);
        console.log("ROM size:", file.size, "bytes");

    } catch (error) {
        console.error("ROM loading error:", error);

        loadedROM = null;

        setStatus(
            "Failed to load ROM: " + error.message,
            "error"
        );
    }
}

/* =========================================================
   FILE INPUT
   ========================================================= */

if (romInput) {
    romInput.addEventListener("change", () => {
        const file = romInput.files && romInput.files[0];

        if (file) {
            handleROM(file);
        }
    });
}

/* =========================================================
   DROP ZONE
   ========================================================= */

if (dropZone) {
    dropZone.addEventListener("click", () => {
        if (romInput) {
            romInput.click();
        }
    });

    dropZone.addEventListener("dragover", event => {
        event.preventDefault();
        dropZone.classList.add("dragover");
    });

    dropZone.addEventListener("dragleave", () => {
        dropZone.classList.remove("dragover");
    });

    dropZone.addEventListener("drop", event => {
        event.preventDefault();

        dropZone.classList.remove("dragover");

        const files = event.dataTransfer.files;

        if (!files || files.length === 0) {
            return;
        }

        handleROM(files[0]);
    });
}

/* =========================================================
   REMOVE ROM
   ========================================================= */

if (removeRom) {
    removeRom.addEventListener("click", () => {
        loadedROM = null;
        generatedSB3 = null;

        if (romInput) {
            romInput.value = "";
        }

        hide(romInfo);
        hide(result);

        if (compileButton) {
            compileButton.disabled = true;
        }

        if (downloadButton) {
            downloadButton.disabled = true;
        }

        setStatus("No ROM loaded.");

        console.log("ROM removed.");
    });
}

/* =========================================================
   CRC32
   ========================================================= */

function crc32(data) {
    let crc = 0xFFFFFFFF;

    for (let i = 0; i < data.length; i++) {
        crc ^= data[i];

        for (let j = 0; j < 8; j++) {
            if (crc & 1) {
                crc = (crc >>> 1) ^ 0xEDB88320;
            } else {
                crc >>>= 1;
            }
        }
    }

    return (crc ^ 0xFFFFFFFF) >>> 0;
}

/* =========================================================
   UINT HELPERS
   ========================================================= */

function writeU16LE(value) {
    return new Uint8Array([
        value & 0xFF,
        (value >>> 8) & 0xFF
    ]);
}

function writeU32LE(value) {
    return new Uint8Array([
        value & 0xFF,
        (value >>> 8) & 0xFF,
        (value >>> 16) & 0xFF,
        (value >>> 24) & 0xFF
    ]);
}

function concatArrays(...arrays) {
    let total = 0;

    for (const array of arrays) {
        total += array.length;
    }

    const output = new Uint8Array(total);

    let offset = 0;

    for (const array of arrays) {
        output.set(array, offset);
        offset += array.length;
    }

    return output;
}

/* =========================================================
   UTF-8
   ========================================================= */

function utf8(text) {
    return new TextEncoder().encode(text);
}

/* =========================================================
   ZIP STORE WRITER
   =========================================================
   This creates an uncompressed ZIP archive.

   SB3 files are ZIP archives.
   ========================================================= */

function createZip(files) {
    const localParts = [];
    const centralParts = [];

    let offset = 0;

    for (const file of files) {
        const nameBytes = utf8(file.name);
        const data = file.data;

        const checksum = crc32(data);

        const localHeader = concatArrays(
            writeU32LE(0x04034B50),
            writeU16LE(20),
            writeU16LE(0),
            writeU16LE(0),
            writeU16LE(0),
            writeU16LE(0),
            writeU32LE(checksum),
            writeU32LE(data.length),
            writeU32LE(data.length),
            writeU16LE(nameBytes.length),
            writeU16LE(0),
            nameBytes
        );

        localParts.push(localHeader, data);

        const centralHeader = concatArrays(
            writeU32LE(0x02014B50),
            writeU16LE(20),
            writeU16LE(20),
            writeU16LE(0),
            writeU16LE(0),
            writeU16LE(0),
            writeU32LE(checksum),
            writeU32LE(data.length),
            writeU32LE(data.length),
            writeU16LE(nameBytes.length),
            writeU16LE(0),
            writeU16LE(0),
            writeU16LE(0),
            writeU16LE(0),
            writeU32LE(0),
            writeU32LE(offset),
            nameBytes
        );

        centralParts.push(centralHeader);

        offset += localHeader.length + data.length;
    }

    const localData = concatArrays(...localParts);
    const centralData = concatArrays(...centralParts);

    const endRecord = concatArrays(
        writeU32LE(0x06054B50),
        writeU16LE(0),
        writeU16LE(0),
        writeU16LE(files.length),
        writeU16LE(files.length),
        writeU32LE(centralData.length),
        writeU32LE(localData.length),
        writeU16LE(0)
    );

    return concatArrays(
        localData,
        centralData,
        endRecord
    );
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
                        bitmapResolution: 1,
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
    return `<svg xmlns="http://www.w3.org/2000/svg"
width="480"
height="360"
viewBox="0 0 480 360">
<rect width="480" height="360" fill="#111111"/>
</svg>`;
}

/* =========================================================
   BUILD SB3
   ========================================================= */

async function buildSB3() {
    if (!loadedROM) {
        throw new Error("No ROM has been loaded.");
    }

    setProgress(10, "Reading ROM...");

    const romBuffer = await loadedROM.arrayBuffer();
    const romBytes = new Uint8Array(romBuffer);

    setProgress(30, "Preparing Scratch project...");

    const project = createProjectJSON();

    const projectBytes = utf8(
        JSON.stringify(project)
    );

    setProgress(50, "Building SB3 archive...");

    const svgBytes = utf8(
        createBackdropSVG()
    );

    const files = [
        {
            name: "project.json",
            data: projectBytes
        },
        {
            name: "ff3f2e0196df3c7d286c4c13e441b003.svg",
            data: svgBytes
        },
        {
            name: "genesis.rom",
            data: romBytes
        }
    ];

    setProgress(70, "Writing ZIP archive...");

    const zipBytes = createZip(files);

    setProgress(90, "Creating SB3 file...");

    const blob = new Blob(
        [zipBytes],
        {
            type: "application/x.scratch.sb3"
        }
    );

    setProgress(100, "Compilation complete!");

    return blob;
}

/* =========================================================
   COMPILE
   ========================================================= */

if (compileButton) {
    compileButton.addEventListener("click", async () => {
        if (!loadedROM) {
            setStatus(
                "Please load a Genesis ROM first.",
                "error"
            );

            return;
        }

        try {
            compileButton.disabled = true;

            hide(result);

            if (downloadButton) {
                downloadButton.disabled = true;
            }

            show(progressContainer);

            setProgress(0, "Starting compiler...");

            setStatus(
                "Compiling ROM..."
            );

            console.log("Starting SB3 compilation...");
            console.log("ROM:", loadedROM.name);
            console.log("Size:", loadedROM.size);

            generatedSB3 = await buildSB3();

            console.log(
                "SB3 generated successfully.",
                generatedSB3.size,
                "bytes"
            );

            /* -----------------------------------------
               SHOW RESULT
               ----------------------------------------- */

            show(result);

            if (resultText) {
                resultText.textContent =
                    `Compilation complete! ` +
                    `Generated SB3: ${formatBytes(generatedSB3.size)}`;
            }

            if (downloadButton) {
                downloadButton.disabled = false;
                downloadButton.classList.remove("hidden");
                downloadButton.style.display = "inline-block";
            }

            setStatus(
                "Compilation complete! Your SB3 is ready.",
                "success"
            );

        } catch (error) {
            console.error(
                "Compilation failed:",
                error
            );

            generatedSB3 = null;

            hide(result);

            setStatus(
                "Compilation failed: " + error.message,
                "error"
            );

            setProgress(
                0,
                "Compilation failed."
            );

        } finally {
            compileButton.disabled = false;
        }
    });
}

/* =========================================================
   DOWNLOAD
   ========================================================= */

if (downloadButton) {
    downloadButton.addEventListener("click", () => {
        if (!generatedSB3) {
            setStatus(
                "There is no generated SB3 to download.",
                "error"
            );

            return;
        }

        try {
            const url = URL.createObjectURL(
                generatedSB3
            );

            const link = document.createElement("a");

            link.href = url;
            link.download =
                "Genesis2SB3-v0.5.2-rom-test.sb3";

            document.body.appendChild(link);

            link.click();

            link.remove();

            setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 1000);

            console.log(
                "SB3 download started."
            );

        } catch (error) {
            console.error(
                "Download failed:",
                error
            );

            setStatus(
                "Download failed: " + error.message,
                "error"
            );
        }
    });
}

/* =========================================================
   INITIAL STATE
   ========================================================= */

if (compileButton) {
    compileButton.disabled = true;
}

if (downloadButton) {
    downloadButton.disabled = true;
}

hide(romInfo);
hide(result);

setProgress(0, "Waiting for ROM...");

setStatus("Load a Genesis ROM to begin.");

console.log(
    "Genesis2SB3 v0.5.2 initialized."
);
