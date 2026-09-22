console.log("THE ONE PIECE IS REAL!!!-Whitebeard (Loaded)");

var romInput = document.getElementById("romInput");
var dropZone = document.getElementById("dropZone");

var romInfo = document.getElementById("romInfo");
var romName = document.getElementById("romName");
var romSize = document.getElementById("romSize");
var romStatus = document.getElementById("romStatus");
var removeRom = document.getElementById("removeRom");

var compileButton = document.getElementById("compileButton");

var progressContainer = document.getElementById("progressContainer");
var progressBar = document.getElementById("progressBar");
var progressText = document.getElementById("progressText");
var progressPercent = document.getElementById("progressPercent");

var status = document.getElementById("status");
var result = document.getElementById("result");
var resultText = document.getElementById("resultText");
var downloadButton = document.getElementById("downloadButton");

var currentROM = null;


/* =========================================================
   UI HELPERS
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

function formatBytes(bytes) {
    if (bytes < 1024) {
        return bytes + " B";
    }

    if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(2) + " KB";
    }

    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function setStatus(message) {
    if (status) {
        status.textContent = message;
    }
}

function setProgress(percent, message) {
    if (progressBar) {
        progressBar.style.width = percent + "%";
    }

    if (progressPercent) {
        progressPercent.textContent =
            Math.round(percent) + "%";
    }

    if (progressText) {
        progressText.textContent = message;
    }
}


/* =========================================================
   ROM LOADING
========================================================= */

function loadROM(file) {
    if (!file) {
        return;
    }

    currentROM = file;

    if (romName) {
        romName.textContent = file.name;
    }

    if (romSize) {
        romSize.textContent =
            formatBytes(file.size);
    }

    if (romStatus) {
        romStatus.textContent =
            "ROM loaded successfully.";
    }

    show(romInfo);
    show(compileButton);

    setStatus(
        "ROM loaded successfully. Compiler ready."
    );
}

if (romInput) {
    romInput.addEventListener(
        "change",
        function () {
            if (
                this.files &&
                this.files.length > 0
            ) {
                loadROM(this.files[0]);
            }
        }
    );
}

if (dropZone) {
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
            dropZone.classList.remove("dragging");
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
                event.dataTransfer &&
                event.dataTransfer.files &&
                event.dataTransfer.files.length > 0
            ) {
                loadROM(
                    event.dataTransfer.files[0]
                );
            }
        }
    );

    dropZone.addEventListener(
        "click",
        function () {
            if (romInput) {
                romInput.click();
            }
        }
    );
}

if (removeRom) {
    removeRom.addEventListener(
        "click",
        function () {
            currentROM = null;

            if (romInput) {
                romInput.value = "";
            }

            hide(romInfo);
            hide(compileButton);
            hide(result);

            setStatus(
                "No ROM loaded."
            );
        }
    );
}


/* =========================================================
   SVG DIAGNOSTIC SCREEN
========================================================= */

function escapeXML(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function createDiagnosticSVG() {
    var filename =
        currentROM
            ? currentROM.name
            : "No ROM";

    var filesize =
        currentROM
            ? formatBytes(currentROM.size)
            : "0 B";

    return `
<svg xmlns="http://www.w3.org/2000/svg"
     width="480"
     height="360"
     viewBox="0 0 480 360">

    <rect
        x="0"
        y="0"
        width="480"
        height="360"
        fill="#202020"/>

    <rect
        x="12"
        y="12"
        width="456"
        height="336"
        fill="#101010"
        stroke="#ffffff"
        stroke-width="2"/>

    <text
        x="240"
        y="42"
        text-anchor="middle"
        font-family="Arial, sans-serif"
        font-size="27"
        font-weight="bold"
        fill="#ffffff">
        GENESIS2SB3
    </text>

    <text
        x="240"
        y="63"
        text-anchor="middle"
        font-family="Arial, sans-serif"
        font-size="11"
        fill="#aaaaaa">
        RUNTIME DIAGNOSTIC
    </text>

    <line
        x1="30"
        y1="76"
        x2="450"
        y2="76"
        stroke="#555555"/>

    <text
        x="30"
        y="100"
        font-family="Arial, sans-serif"
        font-size="13"
        fill="#ffffff">
        ROM:
    </text>

    <text
        x="450"
        y="100"
        text-anchor="end"
        font-family="Arial, sans-serif"
        font-size="13"
        fill="#55ff88">
        ${escapeXML(filename)}
    </text>

    <text
        x="30"
        y="121"
        font-family="Arial, sans-serif"
        font-size="13"
        fill="#ffffff">
        SIZE:
    </text>

    <text
        x="450"
        y="121"
        text-anchor="end"
        font-family="Arial, sans-serif"
        font-size="13"
        fill="#55ff88">
        ${escapeXML(filesize)}
    </text>

    <line
        x1="30"
        y1="136"
        x2="450"
        y2="136"
        stroke="#333333"/>

    <text
        x="30"
        y="158"
        font-family="Arial, sans-serif"
        font-size="13"
        fill="#ffffff">
        ROM LOADED
    </text>

    <text
        x="450"
        y="158"
        text-anchor="end"
        font-family="Arial, sans-serif"
        font-size="13"
        fill="#55ff88">
        YES
    </text>

    <text
        x="30"
        y="180"
        font-family="Arial, sans-serif"
        font-size="13"
        fill="#ffffff">
        JSZIP ARCHIVE
    </text>

    <text
        x="450"
        y="180"
        text-anchor="end"
        font-family="Arial, sans-serif"
        font-size="13"
        fill="#55ff88">
        VERIFIED
    </text>

    <text
        x="30"
        y="202"
        font-family="Arial, sans-serif"
        font-size="13"
        fill="#ffffff">
        SB3 PROJECT
    </text>

    <text
        x="450"
        y="202"
        text-anchor="end"
        font-family="Arial, sans-serif"
        font-size="13"
        fill="#55ff88">
        LOADED
    </text>

    <line
        x1="30"
        y1="217"
        x2="450"
        y2="217"
        stroke="#333333"/>

    <text
        x="30"
        y="239"
        font-family="Arial, sans-serif"
        font-size="13"
        fill="#ffffff">
        68000 CPU
    </text>

    <text
        x="450"
        y="239"
        text-anchor="end"
        font-family="Arial, sans-serif"
        font-size="13"
        fill="#ffaa44">
        NOT IMPLEMENTED
    </text>

    <text
        x="30"
        y="259"
        font-family="Arial, sans-serif"
        font-size="13"
        fill="#ffffff">
        Z80
    </text>

    <text
        x="450"
        y="259"
        text-anchor="end"
        font-family="Arial, sans-serif"
        font-size="13"
        fill="#ffaa44">
        NOT IMPLEMENTED
    </text>

    <text
        x="30"
        y="279"
        font-family="Arial, sans-serif"
        font-size="13"
        fill="#ffffff">
        VDP
    </text>

    <text
        x="450"
        y="279"
        text-anchor="end"
        font-family="Arial, sans-serif"
        font-size="13"
        fill="#ffaa44">
        NOT IMPLEMENTED
    </text>

    <text
        x="30"
        y="299"
        font-family="Arial, sans-serif"
        font-size="13"
        fill="#ffffff">
        YM2612
    </text>

    <text
        x="450"
        y="299"
        text-anchor="end"
        font-family="Arial, sans-serif"
        font-size="13"
        fill="#ffaa44">
        NOT IMPLEMENTED
    </text>

    <text
        x="30"
        y="319"
        font-family="Arial, sans-serif"
        font-size="13"
        fill="#ffffff">
        CONTROLLER
    </text>

    <text
        x="450"
        y="319"
        text-anchor="end"
        font-family="Arial, sans-serif"
        font-size="13"
        fill="#ffaa44">
        NOT IMPLEMENTED
    </text>

    <text
        x="240"
        y="340"
        text-anchor="middle"
        font-family="Arial, sans-serif"
        font-size="9"
        fill="#777777">
        Genesis2SB3 v0.6
    </text>

</svg>`;
}


/* =========================================================
   SCRATCH PROJECT JSON
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

                        name:
                            "Genesis2SB3 Diagnostic",

                        bitmapResolution: 1,

                        md5ext:
                            "ff3f2e0196df3c7d286c4c13e441b003.svg",

                        dataFormat:
                            "svg",

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
            agent: "Genesis2SB3"
        }
    };
}


/* =========================================================
   BUILD
========================================================= */

async function buildSB3() {
    if (!currentROM) {
        setStatus(
            "Please load a Genesis ROM first."
        );
        return;
    }

    if (typeof JSZip === "undefined") {
        setStatus(
            "ERROR: JSZip is not loaded."
        );

        console.error(
            "JSZip is undefined."
        );

        return;
    }

    try {
        show(progressContainer);
        hide(result);

        setProgress(
            5,
            "Reading ROM..."
        );

        var romBuffer =
            await currentROM.arrayBuffer();

        var romBytes =
            new Uint8Array(romBuffer);

        console.log(
            "ROM size:",
            romBytes.length
        );

        console.log(
            "ROM filename:",
            currentROM.name
        );

        setProgress(
            20,
            "ROM loaded."
        );

        setProgress(
            35,
            "Checking Genesis ROM..."
        );

        var genesisSized =
            romBytes.length >= 0x200 &&
            romBytes.length <= 0x1000000;

        console.log(
            "Genesis-sized ROM:",
            genesisSized
        );

        setProgress(
            50,
            "Creating Scratch project..."
        );

        var project =
            createProjectJSON();

        var projectText =
            JSON.stringify(
                project,
                null,
                2
            );

        setProgress(
            60,
            "Creating visible diagnostic..."
        );

        var svg =
            createDiagnosticSVG();

        /*
         * IMPORTANT:
         *
         * JSZip is the ONLY ZIP writer.
         * We are NOT manually constructing
         * ZIP headers or PK signatures.
         */

        console.log(
            "JSZip loaded:",
            typeof JSZip
        );

        var zip =
            new JSZip();

        zip.file(
            "project.json",
            projectText
        );

        zip.file(
            "ff3f2e0196df3c7d286c4c13e441b003.svg",
            svg
        );

        setProgress(
            70,
            "Generating SB3 with JSZip..."
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
                        70 +
                        metadata.percent * 0.25;

                    setProgress(
                        percent,
                        "Building SB3 archive..."
                    );
                }
            );

        /* =================================================
           ZIP VERIFICATION
        ================================================= */

        var bytes =
            new Uint8Array(
                await blob.arrayBuffer()
            );

        console.log(
            "Generated SB3 size:",
            bytes.length
        );

        console.log(
            "First four bytes:",
            Array.from(
                bytes.slice(0, 4)
            )
        );

        if (
            bytes[0] !== 80 ||
            bytes[1] !== 75
        ) {
            throw new Error(
                "JSZip did not produce a valid ZIP archive."
            );
        }

        console.log(
            "ZIP signature verified: PK"
        );

        setProgress(
            100,
            "SB3 generated successfully."
        );

        var url =
            URL.createObjectURL(blob);

        if (downloadButton) {
            downloadButton.onclick =
                function () {
                    var link =
                        document.createElement(
                            "a"
                        );

                    link.href = url;

                    link.download =
                        "Genesis2SB3-v0.6-diagnostic.sb3";

                    document.body.appendChild(
                        link
                    );

                    link.click();

                    link.remove();
                };
        }

        if (resultText) {
            resultText.textContent =
                "SB3 generated successfully. " +
                "JSZip archive verified. " +
                "Diagnostic screen included.";
        }

        show(result);

        setStatus(
            "SB3 generated successfully."
        );

        console.log(
            "Genesis2SB3 v0.6 diagnostic generated."
        );

    } catch (error) {
        console.error(
            "Genesis2SB3 build error:",
            error
        );

        setStatus(
            "Build failed: " +
            error.message
        );

        if (progressText) {
            progressText.textContent =
                "Build failed.";
        }
    }
}


/* =========================================================
   COMPILE BUTTON
========================================================= */

if (compileButton) {
    compileButton.addEventListener(
        "click",
        buildSB3
    );
}
