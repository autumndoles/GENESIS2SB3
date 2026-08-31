console.log("THE ONE PIECE IS REAL!!!-Whitebeard (Loaded)");

var romInput = document.getElementById("romInput");
var dropZone = document.getElementById("dropZone");
var romInfo = document.getElementById("romInfo");
var romName = document.getElementById("romName");
var romSize = document.getElementById("romSize");
var romStatus = document.getElementById("romStatus");
var removeRom = document.getElementById("removeRom");
var compileButton = document.getElementById("compileButton");
var statusBox = document.getElementById("status");
var progressContainer = document.getElementById("progressContainer");
var progressBar = document.getElementById("progressBar");
var progressText = document.getElementById("progressText");
var progressPercent = document.getElementById("progressPercent");
var result = document.getElementById("result");
var resultText = document.getElementById("resultText");
var downloadButton = document.getElementById("downloadButton");

var currentROM = null;
var currentROMData = null;
var currentROMInfo = null;
var generatedSB3 = null;
var generatedSB3Name = "Genesis2SB3-Game.sb3";

function setStatus(message) {
    if (statusBox) {
        statusBox.textContent = message;
    }

    console.log(message);
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

function setProgress(percent, message) {
    var safePercent = Math.max(
        0,
        Math.min(100, percent)
    );

    if (progressBar) {
        progressBar.style.width = safePercent + "%";
    }

    if (progressPercent) {
        progressPercent.textContent =
            Math.round(safePercent) + "%";
    }

    if (progressText) {
        progressText.textContent = message;
    }
}

function readString(data, start, length) {
    var resultString = "";

    for (var i = 0; i < length; i++) {
        var value = data[start + i];

        if (value === undefined) {
            break;
        }

        if (value >= 32 && value <= 126) {
            resultString += String.fromCharCode(value);
        } else {
            resultString += " ";
        }
    }

    return resultString.trim();
}

function readUInt16BE(data, offset) {
    if (offset + 1 >= data.length) {
        return 0;
    }

    return (
        (data[offset] << 8) |
        data[offset + 1]
    ) >>> 0;
}

function readUInt32BE(data, offset) {
    if (offset + 3 >= data.length) {
        return 0;
    }

    return (
        (
            (data[offset] << 24) |
            (data[offset + 1] << 16) |
            (data[offset + 2] << 8) |
            data[offset + 3]
        ) >>> 0
    );
}

function findGenesisHeader(data) {
    var possibleOffsets = [
        0x100,
        0x200,
        0x300
    ];

    for (var i = 0; i < possibleOffsets.length; i++) {
        var offset = possibleOffsets[i];

        if (offset + 0x100 > data.length) {
            continue;
        }

        var system = readString(
            data,
            offset,
            16
        );

        if (system.indexOf("SEGA") !== -1) {
            return offset;
        }
    }

    return -1;
}

function parseGenesisHeader(data) {
    var offset = findGenesisHeader(data);

    if (offset === -1) {
        return {
            valid: false,
            offset: -1
        };
    }

    return {
        valid: true,
        offset: offset,

        system: readString(
            data,
            offset,
            16
        ),

        copyright: readString(
            data,
            offset + 0x10,
            16
        ),

        domesticName: readString(
            data,
            offset + 0x20,
            48
        ),

        overseasName: readString(
            data,
            offset + 0x50,
            48
        ),

        checksum: readUInt16BE(
            data,
            offset + 0x8E
        ),

        productNumber: readString(
            data,
            offset + 0x82,
            14
        ),

        version: readString(
            data,
            offset + 0x90,
            2
        ),

        romStart: readUInt32BE(
            data,
            offset + 0xA0
        ),

        romEnd: readUInt32BE(
            data,
            offset + 0xA4
        ),

        ramStart: readUInt32BE(
            data,
            offset + 0xA8
        ),

        ramEnd: readUInt32BE(
            data,
            offset + 0xAC
        ),

        region: readString(
            data,
            offset + 0xF0,
            3
        )
    };
}

function detectSMD(data) {
    if (data.length < 0x400) {
        return false;
    }

    if (
        data[0] === 0x00 &&
        data[1] === 0x00 &&
        data[2] === 0x00 &&
        data[3] === 0x00
    ) {
        return true;
    }

    return false;
}

function loadROM(file) {
    if (!file) {
        setStatus("No ROM selected.");
        return;
    }

    var filename = file.name.toLowerCase();

    var validExtension =
        filename.endsWith(".md") ||
        filename.endsWith(".bin") ||
        filename.endsWith(".gen") ||
        filename.endsWith(".smd");

    if (!validExtension) {
        setStatus(
            "Unsupported file type. Use .MD, .BIN, .GEN, or .SMD."
        );
        return;
    }

    setStatus("Reading ROM...");

    var reader = new FileReader();

    reader.onload = function(event) {
        try {
            currentROM = file;

            currentROMData = new Uint8Array(
                event.target.result
            );

            var smd = detectSMD(
                currentROMData
            );

            var header = parseGenesisHeader(
                currentROMData
            );

            currentROMInfo = {
                filename: file.name,
                size: currentROMData.length,
                format: smd ? "SMD" : "Standard",
                header: header
            };

            console.log(
                "ROM loaded successfully:",
                currentROMData.length,
                "bytes"
            );

            console.log(
                "Format:",
                currentROMInfo.format
            );

            if (header.valid) {
                console.log(
                    "Genesis header found at:",
                    "0x" +
                    header.offset
                        .toString(16)
                        .toUpperCase()
                );

                console.log(
                    "Game:",
                    header.overseasName ||
                    header.domesticName ||
                    "Unknown"
                );

                console.log(
                    "Region:",
                    header.region || "Unknown"
                );

                console.log(
                    "Checksum:",
                    "0x" +
                    header.checksum
                        .toString(16)
                        .toUpperCase()
                );
            } else {
                console.warn(
                    "No standard Genesis header found."
                );
            }

            if (romName) {
                romName.textContent =
                    file.name;
            }

            if (romSize) {
                romSize.textContent =
                    formatBytes(
                        currentROMData.length
                    ) +
                    " • " +
                    currentROMInfo.format;
            }

            if (romStatus) {
                romStatus.textContent =
                    header.valid
                        ? "Genesis ROM detected"
                        : "ROM loaded";
            }

            if (romInfo) {
                romInfo.classList.remove(
                    "hidden"
                );
            }

            if (compileButton) {
                compileButton.disabled = false;
            }

            if (header.valid) {
                var gameName =
                    header.overseasName ||
                    header.domesticName ||
                    file.name;

                setStatus(
                    "Genesis ROM detected: " +
                    gameName
                );
            } else {
                setStatus(
                    "ROM loaded. Genesis header not found."
                );
            }

        } catch (error) {
            console.error(
                "ROM processing error:",
                error
            );

            currentROM = null;
            currentROMData = null;
            currentROMInfo = null;

            setStatus(
                "Failed to process ROM: " +
                error.message
            );
        }
    };

    reader.onerror = function() {
        currentROM = null;
        currentROMData = null;
        currentROMInfo = null;

        setStatus(
            "Failed to read the ROM file."
        );
    };

    reader.readAsArrayBuffer(file);
}

function makeProjectJSON() {
    var gameName = "Genesis Game";

    if (
        currentROMInfo &&
        currentROMInfo.header &&
        currentROMInfo.header.valid
    ) {
        gameName =
            currentROMInfo.header.overseasName ||
            currentROMInfo.header.domesticName ||
            gameName;
    }

    var project = {
        targets: [
            {
                isStage: true,
                name: "Stage",
                variables: {
                    rom_name: [
                        "ROM Name",
                        currentROM
                            ? currentROM.name
                            : ""
                    ],
                    rom_size: [
                        "ROM Size",
                        currentROMData
                            ? String(
                                currentROMData.length
                            )
                            : "0"
                    ],
                    rom_loaded: [
                        "ROM Loaded",
                        "YES"
                    ]
                },
                lists: {},
                broadcasts: {},
                blocks: {},
                comments: {},
                currentCostume: 0,
                costumes: [],
                sounds: [],
                volume: 100,
                layerOrder: 0,
                tempo: 60,
                videoState: "on",
                videoTransparency: 50,
                textToSpeechLanguage: null
            }
        ],
        monitors: [],
        extensions: [],
        meta: {
            semver: "3.0.0",
            vm: "0.2.0",
            agent: "Genesis2SB3 v0.4"
        }
    };

    project.targets[0].name =
        gameName;

    return JSON.stringify(
        project,
        null,
        2
    );
}

function crc32(data) {
    var table = crc32.table;

    if (!table) {
        table = [];

        for (var n = 0; n < 256; n++) {
            var c = n;

            for (var k = 0; k < 8; k++) {
                if (c & 1) {
                    c =
                        0xEDB88320 ^
                        (c >>> 1);
                } else {
                    c = c >>> 1;
                }
            }

            table[n] = c >>> 0;
        }

        crc32.table = table;
    }

    var crc = 0xFFFFFFFF;

    for (var i = 0; i < data.length; i++) {
        crc =
            table[
                (crc ^ data[i]) & 0xFF
            ] ^
            (crc >>> 8);
    }

    return (
        crc ^ 0xFFFFFFFF
    ) >>> 0;
}

function writeUInt16LE(value) {
    return new Uint8Array([
        value & 0xFF,
        (value >>> 8) & 0xFF
    ]);
}

function writeUInt32LE(value) {
    return new Uint8Array([
        value & 0xFF,
        (value >>> 8) & 0xFF,
        (value >>> 16) & 0xFF,
        (value >>> 24) & 0xFF
    ]);
}

function concatArrays(arrays) {
    var total = 0;

    for (var i = 0; i < arrays.length; i++) {
        total += arrays[i].length;
    }

    var output = new Uint8Array(total);
    var position = 0;

    for (var j = 0; j < arrays.length; j++) {
        output.set(
            arrays[j],
            position
        );

        position += arrays[j].length;
    }

    return output;
}

function makeZip(files) {
    var localParts = [];
    var centralParts = [];

    var offset = 0;

    for (var i = 0; i < files.length; i++) {
        var nameBytes =
            new TextEncoder().encode(
                files[i].name
            );

        var data = files[i].data;

        var checksum = crc32(data);

        var localHeader = concatArrays([
            new Uint8Array([
                0x50,
                0x4B,
                0x03,
                0x04
            ]),
            writeUInt16LE(20),
            writeUInt16LE(0),
            writeUInt16LE(0),
            writeUInt16LE(0),
            writeUInt16LE(0),
            writeUInt32LE(checksum),
            writeUInt32LE(data.length),
            writeUInt32LE(data.length),
            writeUInt16LE(nameBytes.length),
            writeUInt16LE(0),
            nameBytes
        ]);

        var localRecord =
            concatArrays([
                localHeader,
                data
            ]);

        localParts.push(
            localRecord
        );

        var centralHeader =
            concatArrays([
                new Uint8Array([
                    0x50,
                    0x4B,
                    0x01,
                    0x02
                ]),
                new Uint8Array([
                    20,
                    0,
                    20,
                    0
                ]),
                writeUInt16LE(0),
                writeUInt16LE(0),
                writeUInt16LE(0),
                writeUInt16LE(0),
                writeUInt32LE(checksum),
                writeUInt32LE(data.length),
                writeUInt32LE(data.length),
                writeUInt16LE(
                    nameBytes.length
                ),
                writeUInt16LE(0),
                writeUInt16LE(0),
                writeUInt16LE(0),
                writeUInt16LE(0),
                writeUInt32LE(0),
                writeUInt32LE(offset),
                nameBytes
            ]);

        centralParts.push(
            centralHeader
        );

        offset += localRecord.length;
    }

    var centralDirectory =
        concatArrays(
            centralParts
        );

    var localDirectory =
        concatArrays(
            localParts
        );

    var endRecord =
        concatArrays([
            new Uint8Array([
                0x50,
                0x4B,
                0x05,
                0x06
            ]),
            writeUInt16LE(0),
            writeUInt16LE(0),
            writeUInt16LE(
                files.length
            ),
            writeUInt16LE(
                files.length
            ),
            writeUInt32LE(
                centralDirectory.length
            ),
            writeUInt32LE(
                localDirectory.length
            ),
            writeUInt16LE(0)
        ]);

    return concatArrays([
        localDirectory,
        centralDirectory,
        endRecord
    ]);
}

function makeSB3() {
    if (!currentROMData) {
        throw new Error(
            "No ROM data is loaded."
        );
    }

    setProgress(
        10,
        "Creating Scratch project..."
    );

    var projectJSON =
        makeProjectJSON();

    var projectBytes =
        new TextEncoder().encode(
            projectJSON
        );

    setProgress(
        35,
        "Preparing ROM asset..."
    );

    var romCopy =
        new Uint8Array(
            currentROMData.length
        );

    romCopy.set(
        currentROMData
    );

    setProgress(
        60,
        "Building SB3 archive..."
    );

    var files = [
        {
            name: "project.json",
            data: projectBytes
        },
        {
            name: "genesis.rom",
            data: romCopy
        }
    ];

    var zipData =
        makeZip(files);

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

function sanitizeFilename(name) {
    var cleaned = name
        .replace(/\.[^/.]+$/, "")
        .replace(/[^a-z0-9_\-]/gi, "_");

    if (!cleaned) {
        cleaned = "GenesisGame";
    }

    return cleaned;
}

function compileROM() {
    if (!currentROMData) {
        setStatus(
            "No ROM loaded. Select a ROM first."
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
            "Starting compiler..."
        );

        var gameBase =
            sanitizeFilename(
                currentROM.name
            );

        generatedSB3Name =
            "Genesis2SB3-" +
            gameBase +
            ".sb3";

        generatedSB3 =
            makeSB3();

        setProgress(
            100,
            "Compilation complete."
        );

        setStatus(
            "ROM packaged successfully into a genuine SB3."
        );

        if (resultText) {
            resultText.textContent =
                "Generated " +
                generatedSB3Name +
                " (" +
                formatBytes(
                    generatedSB3.size
                ) +
                "). The ROM is stored inside the project as genesis.rom.";
        }

        if (result) {
            result.classList.remove(
                "hidden"
            );
        }

        console.log(
            "SB3 generated successfully."
        );

        console.log(
            "Filename:",
            generatedSB3Name
        );

        console.log(
            "Size:",
            generatedSB3.size,
            "bytes"
        );

    } catch (error) {
        console.error(
            "Compilation failed:",
            error
        );

        setStatus(
            "Compilation failed: " +
            error.message
        );
    }

    if (compileButton) {
        compileButton.disabled = false;
    }
}

function downloadSB3() {
    if (!generatedSB3) {
        setStatus(
            "No SB3 has been generated yet."
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
        generatedSB3Name;

    document.body.appendChild(
        link
    );

    link.click();

    document.body.removeChild(
        link
    );

    setTimeout(
        function() {
            URL.revokeObjectURL(url);
        },
        1000
    );

    setStatus(
        "SB3 download started."
    );
}

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

            var files =
                event.dataTransfer.files;

            if (
                files &&
                files.length > 0
            ) {
                loadROM(files[0]);
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
            currentROMInfo = null;
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
                compileButton.disabled =
                    true;
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
        compileROM
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
    "Genesis2SB3 v0.4 ready."
);
