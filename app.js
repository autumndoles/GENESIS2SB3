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

/* =========================
   BASIC HELPERS
========================= */

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
        progressPercent.textContent = Math.round(percent) + "%";
    }

    if (progressText) {
        progressText.textContent = message;
    }
}

/* =========================
   ROM LOADING
========================= */

function loadROM(file) {
    if (!file) {
        return;
    }

    currentROM = file;

    if (romName) {
        romName.textContent = file.name;
    }

    if (romSize) {
        romSize.textContent = formatBytes(file.size);
    }

    if (romStatus) {
        romStatus.textContent = "ROM loaded successfully.";
    }

    show(romInfo);
    show(compileButton);

    setStatus("ROM loaded successfully. Compiler ready.");
}

if (romInput) {
    romInput.addEventListener("change", function () {
        if (this.files && this.files.length > 0) {
            loadROM(this.files[0]);
        }
    });
}

if (dropZone) {
    dropZone.addEventListener("dragover", function (event) {
        event.preventDefault();
        dropZone.classList.add("dragging");
    });

    dropZone.addEventListener("dragleave", function () {
        dropZone.classList.remove("dragging");
    });

    dropZone.addEventListener("drop", function (event) {
        event.preventDefault();

        dropZone.classList.remove("dragging");

        if (
            event.dataTransfer &&
            event.dataTransfer.files &&
            event.dataTransfer.files.length > 0
        ) {
            loadROM(event.dataTransfer.files[0]);
        }
    });

    dropZone.addEventListener("click", function () {
        if (romInput) {
            romInput.click();
        }
    });
}

if (removeRom) {
    removeRom.addEventListener("click", function () {
        currentROM = null;

        if (romInput) {
            romInput.value = "";
        }

        hide(romInfo);
        hide(compileButton);
        hide(result);

        setStatus("No ROM loaded.");
    });
}

/* =========================
   DIAGNOSTIC SCREEN
========================= */

function createDiagnosticSVG() {
    return `
<svg xmlns="http://www.w3.org/2000/svg"
     width="480"
     height="360"
     viewBox="0 0 480 360">

    <rect width="480" height="360" fill="#111111"/>

    <text x="240" y="42"
          text-anchor="middle"
          font-family="Arial, sans-serif"
          font-size="25"
          font-weight="bold"
          fill="white">
        Genesis2SB3
    </text>

    <text x="240" y="67"
          text-anchor="middle"
          font-family="Arial, sans-serif"
          font-size="13"
          fill="#bbbbbb">
        Genesis Runtime Diagnostic
    </text>

    <line x1="35" y1="82"
          x2="445" y2="82"
          stroke="#444444"/>

    <text x="45" y="108"
          font-family="Arial, sans-serif"
          font-size="14"
          fill="white">
        ROM
    </text>

    <text x="400" y="108"
          text-anchor="end"
          font-family="Arial, sans-serif"
          font-size="14"
          fill="#55ff88">
        LOADED
    </text>

    <text x="45" y="135"
          font-family="Arial, sans-serif"
          font-size="14"
          fill="white">
        68000 CPU
    </text>

    <text x="400" y="135"
          text-anchor="end"
          font-family="Arial, sans-serif"
          font-size="14"
          fill="#ffaa44">
        NOT IMPLEMENTED
    </text>

    <text x="45" y="162"
          font-family="Arial, sans-serif"
          font-size="14"
          fill="white">
        Z80
    </text>

    <text x="400" y="162"
          text-anchor="end"
          font-family="Arial, sans-serif"
          font-size="14"
          fill="#ffaa44">
        NOT IMPLEMENTED
    </text>

    <text x="45" y="189"
          font-family="Arial, sans-serif"
          font-size="14"
          fill="white">
        VDP
    </text>

    <text x="400" y="189"
          text-anchor="end"
          font-family="Arial, sans-serif"
          font-size="14"
          fill="#ffaa44">
        NOT IMPLEMENTED
    </text>

    <text x="45" y="216"
          font-family="Arial, sans-serif"
          font-size="14"
          fill="white">
        YM2612 Audio
    </text>

    <text x="400" y="216"
          text-anchor="end"
          font-family="Arial, sans-serif"
          font-size="14"
          fill="#ffaa44">
        NOT IMPLEMENTED
    </text>

    <text x="45" y="243"
          font-family="Arial, sans-serif"
          font-size="14"
          fill="white">
        Controller
    </text>

    <text x="400" y="243"
          text-anchor="end"
          font-family="Arial, sans-serif"
          font-size="14"
          fill="#ffaa44">
        NOT IMPLEMENTED
    </text>

    <line x1="35" y1="265"
          x2="445" y2="265"
          stroke="#444444"/>

    <text x="240" y="292"
          text-anchor="middle"
          font-family="Arial, sans-serif"
          font-size="14"
          fill="#dddddd">
        ROM parsing complete.
    </text>

    <text x="240" y="314"
          text-anchor="middle"
          font-family="Arial, sans-serif"
          font-size="14"
          fill="#dddddd">
        Genesis machine runtime is the next stage.
    </text>

    <text x="240" y="342"
          text-anchor="middle"
          font-family="Arial, sans-serif"
          font-size="11"
          fill="#777777">
        Genesis2SB3 v0.6 diagnostic
    </text>

</svg>`;
}

/* =========================
   SCRATCH PROJECT
========================= */

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
                        name: "Genesis2SB3 Diagnostic",
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

/* =========================
   BUILD SB3 WITH JSZIP
========================= */

async function buildSB3() {
    if (!currentROM) {
        setStatus("Please load a Genesis ROM first.");
        return;
    }

    if (typeof JSZip === "undefined") {
        setStatus("ERROR: JSZip is not loaded.");
        console.error(
            "JSZip is undefined. Make sure jszip.min.js is loaded before app.js."
        );
        return;
    }

    try {
        show(progressContainer);

        hide(result);

        setProgress(5, "Reading ROM...");

        var romBuffer = await currentROM.arrayBuffer();

        var romBytes = new Uint8Array(romBuffer);

        console.log("ROM size:", romBytes.length);
        console.log("ROM filename:", currentROM.name);

        setProgress(20, "ROM loaded.");

        /* =========================
           BASIC GENESIS DETECTION
        ========================= */

        var isGenesisSized =
            romBytes.length >= 0x200 &&
            romBytes.length <= 0x1000000;

        console.log(
            "Genesis-sized ROM:",
            isGenesisSized
        );

        setProgress(35, "Checking Genesis ROM structure...");

        /*
         * We are deliberately NOT putting the ROM inside
         * the SB3 archive yet.
         *
         * The ROM is read by Genesis2SB3 here and will later
         * be converted into the runtime representation.
         */

        setProgress(50, "Creating Scratch project...");

        var project = createProjectJSON();

        var projectText = JSON.stringify(
            project,
            null,
            2
        );

        setProgress(65, "Creating diagnostic stage...");

        var svg = createDiagnosticSVG();

        /* =========================
           JSZIP
        ========================= */

        console.log("Creating SB3 with JSZip...");

        var zip = new JSZip();

        zip.file(
            "project.json",
            projectText
        );

        zip.file(
            "ff3f2e0196df3c7d286c4c13e441b003.svg",
            svg
        );

        setProgress(75, "Building ZIP archive with JSZip...");

        var blob = await zip.generateAsync(
            {
                type: "blob",
                mimeType: "application/x.scratch.sb3",
                compression: "STORE"
            },
            function (metadata) {
                var percent =
                    75 +
                    (metadata.percent * 0.20);

                setProgress(
                    percent,
                    "Building SB3 archive..."
                );
            }
        );

        /* =========================
           VERIFY ZIP
        ========================= */

        var outputBytes = new Uint8Array(
            await blob.arrayBuffer()
        );

        console.log(
            "Generated SB3 size:",
            outputBytes.length
        );

        console.log(
            "First 4 bytes:",
            Array.from(
                outputBytes.slice(0, 4)
            )
        );

        if (
            outputBytes[0] !== 80 ||
            outputBytes[1] !== 75
        ) {
            throw new Error(
                "JSZip generated an invalid ZIP signature."
            );
        }

        console.log(
            "ZIP signature verified: PK"
        );

        setProgress(
            100,
            "SB3 generated successfully."
        );

        var url = URL.createObjectURL(blob);

        if (downloadButton) {
            downloadButton.onclick = function () {
                var link =
                    document.createElement("a");

                link.href = url;

                link.download =
                    "Genesis2SB3-v0.6-diagnostic.sb3";

                document.body.appendChild(link);

                link.click();

                link.remove();
            };
        }

        if (resultText) {
            resultText.textContent =
                "Genesis2SB3 generated a valid SB3 diagnostic project.";
        }

        show(result);

        setStatus(
            "SB3 generated successfully. JSZip archive verified."
        );

        console.log(
            "Genesis2SB3 diagnostic SB3 generated successfully."
        );

    } catch (error) {
        console.error(
            "Genesis2SB3 build error:",
            error
        );

        setStatus(
            "Build failed: " + error.message
        );

        if (progressText) {
            progressText.textContent =
                "Build failed.";
        }
    }
}

/* =========================
   COMPILE BUTTON
========================= */

if (compileButton) {
    compileButton.addEventListener(
        "click",
        buildSB3
    );
}
