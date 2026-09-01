"use strict";

console.log("THE ONE PIECE IS REAL!!!-Whitebeard (Loaded)");

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

let loadedROM = null;
let generatedSB3 = null;

function show(el) {
    if (el) el.classList.remove("hidden");
}

function hide(el) {
    if (el) el.classList.add("hidden");
}

function formatBytes(n) {
    if (n < 1024) return n + " B";
    if (n < 1048576) return (n / 1024).toFixed(2) + " KB";
    return (n / 1048576).toFixed(2) + " MB";
}

function setStatus(text, type = "") {
    if (!status) return;

    status.textContent = text;
    status.className = "status" + (type ? " " + type : "");
}

function setProgress(percent, text) {
    if (progressBar) {
        progressBar.style.width = percent + "%";
    }

    if (progressPercent) {
        progressPercent.textContent = Math.round(percent) + "%";
    }

    if (progressText) {
        progressText.textContent = text;
    }
}

/* =========================================================
   ROM LOADING
   ========================================================= */

function handleROM(file) {
    if (!file) return;

    loadedROM = file;
    generatedSB3 = null;

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
        "ROM loaded:",
        file.name,
        file.size,
        "bytes"
    );
}

/* =========================================================
   FILE INPUT
   ========================================================= */

if (romInput) {
    romInput.addEventListener("change", () => {
        if (romInput.files && romInput.files[0]) {
            handleROM(romInput.files[0]);
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

        if (
            event.dataTransfer.files &&
            event.dataTransfer.files[0]
        ) {
            handleROM(event.dataTransfer.files[0]);
        }
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

        setProgress(
            0,
            "Waiting for ROM..."
        );

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
            crc = (crc & 1)
                ? ((crc >>> 1) ^ 0xEDB88320)
                : (crc >>> 1);
        }
    }

    return (crc ^ 0xFFFFFFFF) >>> 0;
}

/* =========================================================
   BINARY HELPERS
   ========================================================= */

function u16(n) {
    return new Uint8Array([
        n & 255,
        (n >>> 8) & 255
    ]);
}

function u32(n) {
    return new Uint8Array([
        n & 255,
        (n >>> 8) & 255,
        (n >>> 16) & 255,
        (n >>> 24) & 255
    ]);
}

function join(...parts) {
    const out = new Uint8Array(
        parts.reduce(
            (total, part) => total + part.length,
            0
        )
    );

    let offset = 0;

    for (const part of parts) {
        out.set(part, offset);
        offset += part.length;
    }

    return out;
}

function text(s) {
    return new TextEncoder().encode(s);
}

/* =========================================================
   ZIP STORE WRITER
   ========================================================= */

function createZip(files) {
    const locals = [];
    const centrals = [];

    let offset = 0;

    for (const file of files) {
        const name = text(file.name);
        const data = file.data;
        const crc = crc32(data);

        const local = join(
            u32(0x04034B50),
            u16(20),
            u16(0),
            u16(0),
            u16(0),
            u16(0),
            u32(crc),
            u32(data.length),
            u32(data.length),
            u16(name.length),
            u16(0),
            name
        );

        locals.push(local, data);

        const central = join(
            u32(0x02014B50),
            u16(20),
            u16(20),
            u16(0),
            u16(0),
            u16(0),
            u32(crc),
            u32(data.length),
            u32(data.length),
            u16(name.length),
            u16(0),
            u16(0),
            u16(0),
            u16(0),
            u32(0),
            u32(offset),
            name
        );

        centrals.push(central);

        offset += local.length + data.length;
    }

    const localData = join(...locals);
    const centralData = join(...centrals);

    const end = join(
        u32(0x06054B50),
        u16(0),
        u16(0),
        u16(files.length),
        u16(files.length),
        u32(centralData.length),
        u32(localData.length),
        u16(0)
    );

    return join(
        localData,
        centralData,
        end
    );
}

/* =========================================================
   VALID SCRATCH PROJECT
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
                        assetId:
                            "ff3f2e0196df3c7d286c4c13e441b003",

                        name: "backdrop1",

                        bitmapResolution: 1,

                        md5ext:
                            "ff3f2e0196df3c7d286c4c13e441b003.svg",

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

function createSVG() {
    return `
<svg
    xmlns="http://www.w3.org/2000/svg"
    width="480"
    height="360"
    viewBox="0 0 480 360"
>
    <rect
        width="480"
        height="360"
        fill="#111111"
    />
</svg>`;
}

/* =========================================================
   BUILD SB3
   ========================================================= */

async function buildSB3() {
    if (!loadedROM) {
        throw new Error(
            "No ROM has been loaded."
        );
    }

    setProgress(
        15,
        "Reading ROM..."
    );

    // Read the ROM so the compiler pipeline
    // is verified, but DO NOT embed it in SB3.
    await loadedROM.arrayBuffer();

    setProgress(
        40,
        "Preparing Scratch project..."
    );

    const project = text(
        JSON.stringify(
            createProjectJSON()
        )
    );

    setProgress(
        65,
        "Preparing project assets..."
    );

    const svg = text(
        createSVG()
    );

    /*
       IMPORTANT:

       v0.5.3 intentionally does NOT put
       the Genesis ROM into the SB3.

       This keeps the generated project identical
       in structure to the known-good v0.4.2 project.

       The Genesis parser/emulator comes next.
    */

    const zip = createZip([
        {
            name: "project.json",
            data: project
        },

        {
            name:
                "ff3f2e0196df3c7d286c4c13e441b003.svg",

            data: svg
        }
    ]);

    setProgress(
        90,
        "Finalizing SB3..."
    );

    return new Blob(
        [zip],
        {
            type: "application/x.scratch.sb3"
        }
    );
}

/* =========================================================
   COMPILE BUTTON
   ========================================================= */

if (compileButton) {
    compileButton.addEventListener(
        "click",
        async () => {

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

                setProgress(
                    0,
                    "Starting compiler..."
                );

                setStatus(
                    "Compiling ROM..."
                );

                console.log(
                    "Genesis2SB3 v0.5.3 compiling:",
                    loadedROM.name
                );

                generatedSB3 =
                    await buildSB3();

                console.log(
                    "SB3 generated:",
                    generatedSB3.size,
                    "bytes"
                );

                show(result);

                if (resultText) {
                    resultText.textContent =
                        "Compilation complete! " +
                        "Generated SB3: " +
                        formatBytes(
                            generatedSB3.size
                        ) +
                        ". ROM embedding is " +
                        "intentionally disabled " +
                        "in v0.5.3.";
                }

                if (downloadButton) {
                    downloadButton.classList.remove(
                        "hidden"
                    );

                    downloadButton.style.display =
                        "inline-block";

                    downloadButton.disabled = false;
                }

                setProgress(
                    100,
                    "Compilation complete!"
                );

                setStatus(
                    "Compilation complete! " +
                    "Your SB3 is ready.",
                    "success"
                );

            } catch (err) {

                console.error(
                    "Compilation failed:",
                    err
                );

                generatedSB3 = null;

                hide(result);

                setProgress(
                    0,
                    "Compilation failed."
                );

                setStatus(
                    "Compilation failed: " +
                    err.message,
                    "error"
                );

            } finally {

                compileButton.disabled = false;
            }
        }
    );
}

/* =========================================================
   DOWNLOAD BUTTON
   ========================================================= */

if (downloadButton) {
    downloadButton.addEventListener(
        "click",
        () => {

            if (!generatedSB3) {
                setStatus(
                    "There is no generated SB3 to download.",
                    "error"
                );

                return;
            }

            const url =
                URL.createObjectURL(
                    generatedSB3
                );

            const link =
                document.createElement("a");

            link.href = url;

            link.download =
                "Genesis2SB3-v0.5.3.sb3";

            document.body.appendChild(link);

            link.click();

            link.remove();

            setTimeout(
                () => URL.revokeObjectURL(url),
                1000
            );

            console.log(
                "SB3 download started."
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
    "Genesis2SB3 v0.5.3 initialized."
);
