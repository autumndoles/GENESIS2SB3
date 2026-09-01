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
var statusBox = document.getElementById("status");
var result = document.getElementById("result");
var resultText = document.getElementById("resultText");
var downloadButton = document.getElementById("downloadButton");

var currentROM = null;
var currentROMData = null;
var generatedSB3 = null;

function setStatus(message) {
    if (statusBox) {
        statusBox.textContent = message;
    }

    console.log(message);
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

function formatBytes(bytes) {
    if (bytes < 1024) {
        return bytes + " B";
    }

    if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(2) + " KB";
    }

    return (bytes / 1024 / 1024).toFixed(2) + " MB";
}


/* =========================================================
   ROM LOADING
========================================================= */

function loadROM(file) {
    if (!file) {
        return;
    }

    var filename = file.name.toLowerCase();

    var valid =
        filename.endsWith(".md") ||
        filename.endsWith(".bin") ||
        filename.endsWith(".gen") ||
        filename.endsWith(".smd");

    if (!valid) {
        setStatus(
            "Unsupported ROM. Use .MD, .BIN, .GEN, or .SMD."
        );
        return;
    }

    setStatus("Reading ROM...");

    var reader = new FileReader();

    reader.onload = function(event) {
        currentROM = file;
        currentROMData = new Uint8Array(
            event.target.result
        );

        if (romName) {
            romName.textContent = file.name;
        }

        if (romSize) {
            romSize.textContent =
                formatBytes(currentROMData.length);
        }

        if (romStatus) {
            romStatus.textContent = "ROM detected";
        }

        if (romInfo) {
            romInfo.classList.remove("hidden");
        }

        if (compileButton) {
            compileButton.disabled = false;
        }

        setStatus(
            "ROM detected: " +
            file.name +
            " (" +
            formatBytes(currentROMData.length) +
            ")"
        );

        console.log(
            "ROM loaded successfully:",
            currentROMData.length,
            "bytes"
        );
    };

    reader.onerror = function() {
        setStatus("Failed to read ROM.");
    };

    reader.readAsArrayBuffer(file);
}


/* =========================================================
   MINIMAL VALID SCRATCH PROJECT
========================================================= */

function createProjectJSON() {
    return JSON.stringify({
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

            vm: "0.2.0",

            agent: "Genesis2SB3 v0.4.2"
        }
    });
}


/* =========================================================
   SVG BACKDROP
========================================================= */

function createBackdropSVG() {
    var svg =
        '<svg xmlns="http://www.w3.org/2000/svg" ' +
        'width="480" height="360" ' +
        'viewBox="0 0 480 360">' +
        '<rect width="480" height="360" fill="#ffffff"/>' +
        '</svg>';

    return new TextEncoder().encode(svg);
}


/* =========================================================
   CRC32
========================================================= */

function crc32(data) {
    var table = [];

    for (var i = 0; i < 256; i++) {
        var c = i;

        for (var j = 0; j < 8; j++) {
            if (c & 1) {
                c =
                    0xEDB88320 ^
                    (c >>> 1);
            } else {
                c = c >>> 1;
            }
        }

        table[i] = c >>> 0;
    }

    var crc = 0xFFFFFFFF;

    for (var k = 0; k < data.length; k++) {
        crc =
            table[
                (crc ^ data[k]) & 0xFF
            ] ^
            (crc >>> 8);
    }

    return (
        crc ^ 0xFFFFFFFF
    ) >>> 0;
}


/* =========================================================
   BINARY HELPERS
========================================================= */

function u16(value) {
    return new Uint8Array([
        value & 255,
        (value >>> 8) & 255
    ]);
}

function u32(value) {
    return new Uint8Array([
        value & 255,
        (value >>> 8) & 255,
        (value >>> 16) & 255,
        (value >>> 24) & 255
    ]);
}

function join(parts) {
    var total = 0;

    for (var i = 0; i < parts.length; i++) {
        total += parts[i].length;
    }

    var output = new Uint8Array(total);

    var position = 0;

    for (var j = 0; j < parts.length; j++) {
        output.set(
            parts[j],
            position
        );

        position += parts[j].length;
    }

    return output;
}


/* =========================================================
   ZIP STORE WRITER
========================================================= */

function createZip(files) {
    var localFiles = [];
    var centralFiles = [];

    var offset = 0;

    var encoder = new TextEncoder();

    for (var i = 0; i < files.length; i++) {
        var file = files[i];

        var nameBytes =
            encoder.encode(file.name);

        var data = file.data;

        var crc = crc32(data);

        var localHeader = join([
            new Uint8Array([
                0x50,
                0x4B,
                0x03,
                0x04
            ]),

            u16(20),

            u16(0),

            u16(0),

            u16(0),

            u16(0),

            u32(crc),

            u32(data.length),

            u32(data.length),

            u16(nameBytes.length),

            u16(0),

            nameBytes
        ]);

        var localFile = join([
            localHeader,
            data
        ]);

        localFiles.push(localFile);


        var centralHeader = join([
            new Uint8Array([
                0x50,
                0x4B,
                0x01,
                0x02
            ]),

            u16(20),

            u16(20),

            u16(0),

            u16(0),

            u16(0),

            u16(0),

            u32(crc),

            u32(data.length),

            u32(data.length),

            u16(nameBytes.length),

            u16(0),

            u16(0),

            u16(0),

            u16(0),

            u32(0),

            u32(offset),

            nameBytes
        ]);

        centralFiles.push(
            centralHeader
        );

        offset += localFile.length;
    }

    var localData = join(localFiles);

    var centralData = join(
        centralFiles
    );

    var endRecord = join([
        new Uint8Array([
            0x50,
            0x4B,
            0x05,
            0x06
        ]),

        u16(0),

        u16(0),

        u16(files.length),

        u16(files.length),

        u32(centralData.length),

        u32(localData.length),

        u16(0)
    ]);

    return join([
        localData,
        centralData,
        endRecord
    ]);
}


/* =========================================================
   GENERATE TEST SB3
========================================================= */

function createTestSB3() {
    setProgress(
        20,
        "Creating project.json..."
    );

    var projectJSON =
        createProjectJSON();

    var projectData =
        new TextEncoder().encode(
            projectJSON
        );

    setProgress(
        45,
        "Creating backdrop..."
    );

    var backdropData =
        createBackdropSVG();

    setProgress(
        65,
        "Building SB3 ZIP..."
    );

    var zipData = createZip([
        {
            name: "project.json",
            data: projectData
        },

        {
            name:
                "ff3f2e0196df3c7d286c4c13e441b003.svg",

            data: backdropData
        }
    ]);

    setProgress(
        90,
        "Finalizing SB3..."
    );

    return new Blob(
        [zipData],
        {
            type:
                "application/x.scratch.sb3"
        }
    );
}


/* =========================================================
   TEST COMPILER
========================================================= */

function compileTestProject() {
    if (!currentROMData) {
        setStatus(
            "Select a ROM first."
        );

        return;
    }

    if (progressContainer) {
        progressContainer.classList.remove(
            "hidden"
        );
    }

    if (result) {
        result.classList.add(
            "hidden"
        );
    }

    if (compileButton) {
        compileButton.disabled = true;
    }

    try {
        setProgress(
            0,
            "Starting v0.4.2 SB3 test..."
        );

        generatedSB3 =
            createTestSB3();

        setProgress(
            100,
            "SB3 test created!"
        );

        setStatus(
            "v0.4.2 test SB3 generated successfully."
        );

        if (resultText) {
            resultText.textContent =
                "TEST ONLY: This SB3 contains a minimal Scratch project and one backdrop. The Genesis ROM is NOT included.";
        }

        if (result) {
            result.classList.remove(
                "hidden"
            );
        }

        console.log(
            "================================"
        );

        console.log(
            "Genesis2SB3 v0.4.2 TEST"
        );

        console.log(
            "SB3 generated:",
            generatedSB3.size,
            "bytes"
        );

        console.log(
            "Contents:"
        );

        console.log(
            " - project.json"
        );

        console.log(
            " - backdrop SVG"
        );

        console.log(
            "ROM intentionally excluded."
        );

        console.log(
            "================================"
        );

    } catch (error) {
        console.error(
            "SB3 generation failed:",
            error
        );

        setStatus(
            "SB3 generation failed: " +
            error.message
        );
    }

    if (compileButton) {
        compileButton.disabled = false;
    }
}


/* =========================================================
   DOWNLOAD
========================================================= */

function downloadSB3() {
    if (!generatedSB3) {
        setStatus(
            "Generate the test SB3 first."
        );

        return;
    }

    var url =
        URL.createObjectURL(
            generatedSB3
        );

    var link =
        document.createElement("a");

    link.href = url;

    link.download =
        "Genesis2SB3-v0.4.2-test.sb3";

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    setTimeout(
        function() {
            URL.revokeObjectURL(url);
        },
        1000
    );
}


/* =========================================================
   UI EVENTS
========================================================= */

if (romInput) {
    romInput.addEventListener(
        "change",
        function(event) {
            if (
                event.target.files &&
                event.target.files.length > 0
            ) {
                loadROM(
                    event.target.files[0]
                );
            }
        }
    );
}

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
        function(event) {
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

if (removeRom) {
    removeRom.addEventListener(
        "click",
        function() {
            currentROM = null;
            currentROMData = null;
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

            if (romStatus) {
                romStatus.textContent =
                    "No ROM selected";
            }

            if (compileButton) {
                compileButton.disabled = true;
            }

            setStatus(
                "Select a Genesis ROM to begin."
            );
        }
    );
}

if (compileButton) {
    compileButton.addEventListener(
        "click",
        compileTestProject
    );
}

if (downloadButton) {
    downloadButton.addEventListener(
        "click",
        downloadSB3
    );
}

setStatus(
    "Select a Genesis ROM to begin."
);

console.log(
    "Genesis2SB3 v0.4.2 ready."
);
