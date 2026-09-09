"use strict";

/*
    Genesis2SB3 v0.5.5

    Real ZIP/SB3 generation using JSZip.

    IMPORTANT:
    - JSZip must be loaded before this file.
    - The ROM is NOT embedded in the SB3.
    - This version is primarily a valid-SB3 test.
*/

console.log("THE ONE PIECE IS REAL!!!-Whitebeard (Loaded)");
console.log("Genesis2SB3 v0.5.5 loaded.");

var romInput = document.getElementById("romInput");
var dropZone = document.getElementById("dropZone");

var romInfo = document.getElementById("romInfo");
var romName = document.getElementById("romName");
var romSize = document.getElementById("romSize");
var romStatus = document.getElementById("romStatus");
var removeRom = document.getElementById("removeRom");

var compileButton =
    document.getElementById("compileButton");

var progressContainer =
    document.getElementById("progressContainer");

var progressBar =
    document.getElementById("progressBar");

var progressText =
    document.getElementById("progressText");

var progressPercent =
    document.getElementById("progressPercent");

var statusBox =
    document.getElementById("status");

var result =
    document.getElementById("result");

var resultText =
    document.getElementById("resultText");

var downloadButton =
    document.getElementById("downloadButton");

var loadedROM = null;
var generatedSB3 = null;

/* =========================================================
   BASIC UI HELPERS
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
    if (!statusBox) {
        return;
    }

    statusBox.textContent = message;
    statusBox.className = "status";

    if (type) {
        statusBox.classList.add(type);
    }

    console.log(message);
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
   JSZIP CHECK
   ========================================================= */

if (typeof JSZip === "undefined") {
    console.error(
        "JSZip was not found."
    );

    setStatus(
        "ERROR: JSZip did not load. Check index.html.",
        "error"
    );
} else {
    console.log(
        "JSZip detected successfully."
    );
}

/* =========================================================
   ROM LOADING
   ========================================================= */

function loadROM(file) {
    if (!file) {
        return;
    }

    loadedROM = file;
    generatedSB3 = null;

    console.log(
        "ROM selected:",
        file.name
    );

    console.log(
        "ROM size:",
        file.size,
        "bytes"
    );

    if (romName) {
        romName.textContent =
            file.name;
    }

    if (romSize) {
        romSize.textContent =
            formatBytes(file.size);
    }

    if (romStatus) {
        romStatus.textContent =
            "ROM detected";
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
}

/* =========================================================
   FILE INPUT
   ========================================================= */

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

    console.log(
        "#romInput found."
    );
} else {
    console.error(
        "Could not find #romInput."
    );
}

/* =========================================================
   DROP ZONE
   ========================================================= */

if (dropZone) {
    dropZone.addEventListener(
        "dragover",
        function (event) {
            event.preventDefault();

            dropZone.classList.add(
                "dragging"
            );
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

    console.log(
        "#dropZone found."
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

            setStatus(
                "Select a Genesis ROM to begin."
            );

            console.log(
                "ROM removed."
            );
        }
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

            agent:
                "Genesis2SB3 v0.5.5"
        }
    };
}

/* =========================================================
   SVG BACKDROP
   ========================================================= */

function createBackdropSVG() {
    return [
        '<svg ',
        'xmlns="http://www.w3.org/2000/svg" ',
        'width="480" ',
        'height="360" ',
        'viewBox="0 0 480 360">',
        '<rect ',
        'width="480" ',
        'height="360" ',
        'fill="#111111"/>',
        '</svg>'
    ].join("");
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

    if (typeof JSZip === "undefined") {
        throw new Error(
            "JSZip is not loaded."
        );
    }

    setProgress(
        10,
        "Reading ROM..."
    );

    /*
        Read the ROM to verify that the ROM
        pipeline works.

        We deliberately DO NOT store it
        inside the SB3 yet.
    */

    var romBuffer =
        await loadedROM.arrayBuffer();

    console.log(
        "ROM read successfully:",
        romBuffer.byteLength,
        "bytes"
    );

    setProgress(
        30,
        "Creating Scratch project..."
    );

    var project =
        createProjectJSON();

    var projectText =
        JSON.stringify(
            project
        );

    setProgress(
        50,
        "Adding project.json..."
    );

    var zip =
        new JSZip();

    zip.file(
        "project.json",
        projectText
    );

    setProgress(
        65,
        "Adding Scratch asset..."
    );

    zip.file(
        "ff3f2e0196df3c7d286c4c13e441b003.svg",
        createBackdropSVG()
    );

    setProgress(
        80,
        "Generating SB3..."
    );

    var blob =
        await zip.generateAsync(
            {
                type: "blob",

                mimeType:
                    "application/x.scratch.sb3",

                compression:
                    "STORE"
            },

            function (metadata) {
                var percent =
                    80 +
                    (
                        metadata.percent * 0.2
                    );

                setProgress(
                    percent,
                    "Generating SB3..."
                );
            }
        );

    console.log(
        "SB3 generated:",
        blob.size,
        "bytes"
    );

    return blob;
}

/* =========================================================
   COMPILE BUTTON
   ========================================================= */

if (compileButton) {
    compileButton.addEventListener(
        "click",
        async function () {
            if (!loadedROM) {
                setStatus(
                    "Please select a ROM first.",
                    "error"
                );

                return;
            }

            if (
                typeof JSZip ===
                "undefined"
            ) {
                setStatus(
                    "JSZip is missing. Check index.html.",
                    "error"
                );

                return;
            }

            compileButton.disabled =
                true;

            hide(result);

            if (downloadButton) {
                downloadButton.disabled =
                    true;
            }

            show(progressContainer);

            try {
                setProgress(
                    0,
                    "Starting compiler..."
                );

                setStatus(
                    "Compiling ROM..."
                );

                console.log(
                    "Genesis2SB3 v0.5.5 compile started."
                );

                generatedSB3 =
                    await buildSB3();

                setProgress(
                    100,
                    "Compilation complete!"
                );

                setStatus(
                    "SB3 generated successfully.",
                    "success"
                );

                show(result);

                if (resultText) {
                    resultText.textContent =
                        "Generated a valid ZIP-based SB3 " +
                        "without embedding the ROM. " +
                        "File size: " +
                        formatBytes(
                            generatedSB3.size
                        );
                }

                if (downloadButton) {
                    downloadButton.disabled =
                        false;

                    downloadButton.style.display =
                        "inline-block";

                    downloadButton.textContent =
                        "Download .sb3";
                }

                console.log(
                    "Compilation finished."
                );

            } catch (error) {
                generatedSB3 = null;

                console.error(
                    "Compilation error:",
                    error
                );

                setProgress(
                    0,
                    "Compilation failed."
                );

                setStatus(
                    "Compilation failed: " +
                    error.message,
                    "error"
                );

                hide(result);

            } finally {
                compileButton.disabled =
                    false;
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
        function () {
            if (!generatedSB3) {
                setStatus(
                    "No SB3 has been generated yet.",
                    "error"
                );

                return;
            }

            var url =
                URL.createObjectURL(
                    generatedSB3
                );

            var link =
                document.createElement(
                    "a"
                );

            link.href = url;

            link.download =
                "Genesis2SB3-v0.5.5.sb3";

            document.body.appendChild(
                link
            );

            link.click();

            document.body.removeChild(
                link
            );

            setTimeout(
                function () {
                    URL.revokeObjectURL(
                        url
                    );
                },
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
    compileButton.disabled =
        true;
}

if (downloadButton) {
    downloadButton.disabled =
        true;
}

hide(romInfo);
hide(result);

setProgress(
    0,
    "Waiting for ROM..."
);

if (
    typeof JSZip !==
    "undefined"
) {
    setStatus(
        "Load a Genesis ROM to begin."
    );
}

console.log(
    "Genesis2SB3 v0.5.5 ready."
);
