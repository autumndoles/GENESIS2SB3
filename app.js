"use strict";

/* =========================================================
   Genesis2SB3 v0.5.4
   Diagnostic SB3/ZIP build
   ROM is NOT embedded.
   ========================================================= */

console.log("THE ONE PIECE IS REAL!!!-Whitebeard (Loaded)");
console.log("Genesis2SB3 v0.5.4 loaded.");

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

let loadedROM = null;
let generatedArchive = null;

/* =========================================================
   HELPERS
   ========================================================= */

function show(element) {
    if (element) {
        element.classList.remove("hidden");
    }
}

function hide(element) {
    if (element) {
        element.classList.add("hidden");
    }
}

function setStatus(message, type) {
    if (!status) {
        return;
    }

    status.textContent = message;
    status.className = "status";

    if (type) {
        status.classList.add(type);
    }
}

function setProgress(percent, message) {
    if (progressBar) {
        progressBar.style.width = percent + "%";
    }

    if (progressText) {
        progressText.textContent = message;
    }

    if (progressPercent) {
        progressPercent.textContent =
            Math.round(percent) + "%";
    }
}

function formatBytes(bytes) {
    if (bytes < 1024) {
        return bytes + " B";
    }

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
}

/* =========================================================
   ROM LOADER
   ========================================================= */

function loadROM(file) {
    if (!file) {
        return;
    }

    loadedROM = file;
    generatedArchive = null;

    if (romName) {
        romName.textContent = file.name;
    }

    if (romSize) {
        romSize.textContent =
            formatBytes(file.size);
    }

    if (romStatus) {
        romStatus.textContent =
            "ROM loaded successfully";
    }

    show(romInfo);
    hide(result);

    if (compileButton) {
        compileButton.disabled = false;
    }

    if (downloadButton) {
        downloadButton.disabled = true;
    }

    setStatus(
        "ROM loaded successfully. Ready to compile.",
        "success"
    );

    console.log(
        "ROM:",
        file.name
    );

    console.log(
        "ROM size:",
        file.size,
        "bytes"
    );
}

if (romInput) {
    romInput.addEventListener(
        "change",
        function () {
            if (
                romInput.files &&
                romInput.files.length > 0
            ) {
                loadROM(
                    romInput.files[0]
                );
            }
        }
    );
}

if (dropZone) {
    dropZone.addEventListener(
        "click",
        function () {
            if (romInput) {
                romInput.click();
            }
        }
    );

    dropZone.addEventListener(
        "dragover",
        function (event) {
            event.preventDefault();
            dropZone.classList.add("dragging");
        }
    );

    dropZone.addEventListener(
        "dragleave",
        function () {
            dropZone.classList.remove(
                "dragging"
            );
        }
    );

    dropZone.addEventListener(
        "drop",
        function (event) {
            event.preventDefault();

            dropZone.classList.remove(
                "dragging"
            );

            if (
                event.dataTransfer.files &&
                event.dataTransfer.files.length > 0
            ) {
                loadROM(
                    event.dataTransfer.files[0]
                );
            }
        }
    );
}

/* =========================================================
   REMOVE ROM
   ========================================================= */

if (removeRom) {
    removeRom.addEventListener(
        "click",
        function () {
            loadedROM = null;
            generatedArchive = null;

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

            setProgress(
                0,
                "Waiting for ROM..."
            );

            setStatus(
                "No ROM loaded."
            );
        }
    );
}

/* =========================================================
   BINARY HELPERS
   ========================================================= */

function textBytes(text) {
    return new TextEncoder().encode(text);
}

function u16(value) {
    return new Uint8Array([
        value & 0xff,
        (value >>> 8) & 0xff
    ]);
}

function u32(value) {
    return new Uint8Array([
        value & 0xff,
        (value >>> 8) & 0xff,
        (value >>> 16) & 0xff,
        (value >>> 24) & 0xff
    ]);
}

function concat() {
    const parts = Array.from(arguments);

    let total = 0;

    for (const part of parts) {
        total += part.length;
    }

    const output =
        new Uint8Array(total);

    let offset = 0;

    for (const part of parts) {
        output.set(part, offset);
        offset += part.length;
    }

    return output;
}

/* =========================================================
   CRC32
   ========================================================= */

function crc32(data) {
    let crc = 0xffffffff;

    for (
        let i = 0;
        i < data.length;
        i++
    ) {
        crc ^= data[i];

        for (
            let bit = 0;
            bit < 8;
            bit++
        ) {
            if (crc & 1) {
                crc =
                    (crc >>> 1) ^
                    0xedb88320;
            } else {
                crc >>>= 1;
            }
        }
    }

    return (
        crc ^
        0xffffffff
    ) >>> 0;
}

/* =========================================================
   MINIMAL SCRATCH PROJECT
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
                        name: "backdrop1",

                        bitmapResolution: 1,

                        dataFormat: "svg",

                        assetId:
                            "ff3f2e0196df3c7d286c4c13e441b003",

                        md5ext:
                            "ff3f2e0196df3c7d286c4c13e441b003.svg",

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

            agent: "Genesis2SB3 v0.5.4"
        }
    };
}

/* =========================================================
   MINIMAL SVG
   ========================================================= */

function createBackdrop() {
    return textBytes(
        '<svg xmlns="http://www.w3.org/2000/svg" ' +
        'width="480" height="360" ' +
        'viewBox="0 0 480 360">' +
        '<rect width="480" height="360" fill="#111111"/>' +
        '</svg>'
    );
}

/* =========================================================
   ZIP CREATOR
   ========================================================= */

function createZip(files) {
    const localRecords = [];
    const centralRecords = [];

    let currentOffset = 0;

    for (const file of files) {
        const name =
            textBytes(file.name);

        const data =
            file.data;

        const checksum =
            crc32(data);

        const localHeader =
            concat(
                u32(0x04034b50),

                u16(20),

                u16(0),

                u16(0),

                u16(0),

                u16(0),

                u32(checksum),

                u32(data.length),

                u32(data.length),

                u16(name.length),

                u16(0),

                name
            );

        localRecords.push(
            localHeader,
            data
        );

        const centralHeader =
            concat(
                u32(0x02014b50),

                u16(20),

                u16(20),

                u16(0),

                u16(0),

                u16(0),

                u32(checksum),

                u32(data.length),

                u32(data.length),

                u16(name.length),

                u16(0),

                u16(0),

                u16(0),

                u16(0),

                u32(0),

                u32(currentOffset),

                name
            );

        centralRecords.push(
            centralHeader
        );

        currentOffset +=
            localHeader.length +
            data.length;
    }

    const localData =
        concat.apply(
            null,
            localRecords
        );

    const centralData =
        concat.apply(
            null,
            centralRecords
        );

    const endRecord =
        concat(
            u32(0x06054b50),

            u16(0),

            u16(0),

            u16(files.length),

            u16(files.length),

            u32(centralData.length),

            u32(localData.length),

            u16(0)
        );

    return concat(
        localData,
        centralData,
        endRecord
    );
}

/* =========================================================
   BUILD DIAGNOSTIC ARCHIVE
   ========================================================= */

async function compileProject() {
    if (!loadedROM) {
        throw new Error(
            "No ROM has been loaded."
        );
    }

    setProgress(
        10,
        "Reading ROM..."
    );

    /*
       The ROM is read here only to verify
       that the input pipeline works.

       It is NOT included in the archive.
    */

    await loadedROM.arrayBuffer();

    setProgress(
        35,
        "Generating project.json..."
    );

    const projectJSON =
        textBytes(
            JSON.stringify(
                createProjectJSON()
            )
        );

    setProgress(
        60,
        "Generating backdrop..."
    );

    const backdrop =
        createBackdrop();

    setProgress(
        80,
        "Building ZIP..."
    );

    const archive =
        createZip([
            {
                name: "project.json",
                data: projectJSON
            },

            {
                name:
                    "ff3f2e0196df3c7d286c4c13e441b003.svg",
                data: backdrop
            }
        ]);

    setProgress(
        100,
        "Archive ready."
    );

    return new Blob(
        [archive],
        {
            type: "application/zip"
        }
    );
}

/* =========================================================
   COMPILE
   ========================================================= */

if (compileButton) {
    compileButton.addEventListener(
        "click",
        async function () {
            if (!loadedROM) {
                setStatus(
                    "Load a ROM first.",
                    "error"
                );

                return;
            }

            compileButton.disabled = true;

            hide(result);

            if (downloadButton) {
                downloadButton.disabled = true;
            }

            show(progressContainer);

            try {
                setProgress(
                    0,
                    "Starting diagnostic build..."
                );

                setStatus(
                    "Building diagnostic archive..."
                );

                console.log(
                    "Starting v0.5.4 diagnostic build."
                );

                generatedArchive =
                    await compileProject();

                console.log(
                    "Archive generated:",
                    generatedArchive.size,
                    "bytes"
                );

                show(result);

                if (resultText) {
                    resultText.textContent =
                        "Diagnostic archive generated: " +
                        formatBytes(
                            generatedArchive.size
                        ) +
                        ". Download the ZIP and inspect its contents.";
                }

                if (downloadButton) {
                    downloadButton.disabled = false;

                    downloadButton.style.display =
                        "inline-block";

                    downloadButton.textContent =
                        "Download Diagnostic ZIP";
                }

                setStatus(
                    "Diagnostic ZIP generated successfully.",
                    "success"
                );

            } catch (error) {
                console.error(
                    "Build failed:",
                    error
                );

                generatedArchive = null;

                hide(result);

                setProgress(
                    0,
                    "Build failed."
                );

                setStatus(
                    "Build failed: " +
                    error.message,
                    "error"
                );

            } finally {
                compileButton.disabled = false;
            }
        }
    );
}

/* =========================================================
   DOWNLOAD
   ========================================================= */

if (downloadButton) {
    downloadButton.addEventListener(
        "click",
        function () {
            if (!generatedArchive) {
                setStatus(
                    "No diagnostic archive exists yet.",
                    "error"
                );

                return;
            }

            const url =
                URL.createObjectURL(
                    generatedArchive
                );

            const link =
                document.createElement("a");

            link.href = url;

            link.download =
                "Genesis2SB3-v0.5.4-diagnostic.zip";

            document.body.appendChild(link);

            link.click();

            link.remove();

            setTimeout(
                function () {
                    URL.revokeObjectURL(url);
                },
                1000
            );

            console.log(
                "Diagnostic ZIP download started."
            );
        }
    );
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

setProgress(
    0,
    "Waiting for ROM..."
);

setStatus(
    "Load a Genesis ROM to begin."
);

console.log(
    "Genesis2SB3 v0.5.4 ready."
);
