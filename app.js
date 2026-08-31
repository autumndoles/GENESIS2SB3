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

var currentROM = null;
var currentROMData = null;
var currentROMInfo = null;

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

function readString(data, start, length) {
    var result = "";

    for (var i = 0; i < length; i++) {
        var value = data[start + i];

        if (value === undefined) {
            break;
        }

        if (value >= 32 && value <= 126) {
            result += String.fromCharCode(value);
        } else {
            result += " ";
        }
    }

    return result.trim();
}

function readUInt32BE(data, offset) {
    if (offset + 3 >= data.length) {
        return 0;
    }

    return (
        ((data[offset] << 24) >>> 0) |
        (data[offset + 1] << 16) |
        (data[offset + 2] << 8) |
        data[offset + 3]
    ) >>> 0;
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

function findGenesisHeader(data) {
    var offsets = [
        0x100,
        0x200,
        0x300
    ];

    for (var i = 0; i < offsets.length; i++) {
        var offset = offsets[i];

        if (offset + 0x100 > data.length) {
            continue;
        }

        var system = readString(data, offset, 16);

        if (
            system.indexOf("SEGA") !== -1 ||
            system.indexOf("SEGA") === 0
        ) {
            return offset;
        }
    }

    if (data.length >= 0x200) {
        var normalHeader = readString(data, 0x100, 4);

        if (normalHeader.indexOf("SEGA") !== -1) {
            return 0x100;
        }
    }

    return -1;
}

function detectSMD(data) {
    if (data.length < 0x400) {
        return false;
    }

    var header = readString(data, 0, 2);

    if (header === "\u0000\u0000") {
        return true;
    }

    var possibleHeader = readUInt16BE(data, 0);

    if (possibleHeader === 0x0000) {
        return true;
    }

    return false;
}

function parseGenesisHeader(data) {
    var headerOffset = findGenesisHeader(data);

    if (headerOffset === -1) {
        return {
            valid: false,
            headerOffset: -1
        };
    }

    var info = {};

    info.valid = true;
    info.headerOffset = headerOffset;

    info.system = readString(
        data,
        headerOffset,
        16
    );

    info.copyright = readString(
        data,
        headerOffset + 0x10,
        16
    );

    info.domesticName = readString(
        data,
        headerOffset + 0x20,
        48
    );

    info.overseasName = readString(
        data,
        headerOffset + 0x50,
        48
    );

    info.productType = readString(
        data,
        headerOffset + 0x80,
        2
    );

    info.productNumber = readString(
        data,
        headerOffset + 0x82,
        14
    );

    info.version = readString(
        data,
        headerOffset + 0x90,
        2
    );

    info.checksum = readUInt16BE(
        data,
        headerOffset + 0x8E
    );

    info.romStart = readUInt32BE(
        data,
        headerOffset + 0xA0
    );

    info.romEnd = readUInt32BE(
        data,
        headerOffset + 0xA4
    );

    info.ramStart = readUInt32BE(
        data,
        headerOffset + 0xA8
    );

    info.ramEnd = readUInt32BE(
        data,
        headerOffset + 0xAC
    );

    info.region = readString(
        data,
        headerOffset + 0xF0,
        3
    );

    return info;
}

function printROMInfo(info) {
    console.log("========== GENESIS ROM INFO ==========");

    console.log(
        "System:",
        info.system || "Unknown"
    );

    console.log(
        "Domestic name:",
        info.domesticName || "Unknown"
    );

    console.log(
        "Overseas name:",
        info.overseasName || "Unknown"
    );

    console.log(
        "Product number:",
        info.productNumber || "Unknown"
    );

    console.log(
        "Version:",
        info.version || "Unknown"
    );

    console.log(
        "Checksum:",
        "0x" + info.checksum.toString(16).toUpperCase()
    );

    console.log(
        "ROM start:",
        "0x" + info.romStart.toString(16).toUpperCase()
    );

    console.log(
        "ROM end:",
        "0x" + info.romEnd.toString(16).toUpperCase()
    );

    console.log(
        "RAM start:",
        "0x" + info.ramStart.toString(16).toUpperCase()
    );

    console.log(
        "RAM end:",
        "0x" + info.ramEnd.toString(16).toUpperCase()
    );

    console.log(
        "Region:",
        info.region || "Unknown"
    );

    console.log("======================================");
}

function loadROM(file) {
    if (!file) {
        setStatus("No ROM selected.");
        return;
    }

    console.log("ROM selected:");
    console.log("Name:", file.name);
    console.log("Type:", file.type);
    console.log("Size:", file.size);

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

            var isSMD = detectSMD(
                currentROMData
            );

            var headerInfo = parseGenesisHeader(
                currentROMData
            );

            currentROMInfo = {
                filename: file.name,
                size: currentROMData.length,
                format: isSMD ? "SMD" : "Standard",
                header: headerInfo
            };

            console.log(
                "ROM loaded successfully:",
                currentROMData.length,
                "bytes"
            );

            console.log(
                "Detected format:",
                currentROMInfo.format
            );

            if (headerInfo.valid) {
                printROMInfo(headerInfo);
            } else {
                console.warn(
                    "No standard Genesis header was found."
                );
            }

            if (romName) {
                romName.textContent = file.name;
            }

            if (romSize) {
                romSize.textContent =
                    formatBytes(
                        currentROMData.length
                    ) +
                    " • " +
                    currentROMInfo.format +
                    " format";
            }

            if (romStatus) {
                if (headerInfo.valid) {
                    romStatus.textContent =
                        "Genesis ROM detected";
                } else {
                    romStatus.textContent =
                        "ROM loaded";
                }
            }

            if (romInfo) {
                romInfo.classList.remove("hidden");
            }

            if (compileButton) {
                compileButton.disabled = false;
            }

            if (headerInfo.valid) {
                var gameName =
                    headerInfo.overseasName ||
                    headerInfo.domesticName ||
                    file.name;

                setStatus(
                    "Genesis ROM detected: " +
                    gameName
                );
            } else {
                setStatus(
                    "ROM loaded, but no Genesis header was detected."
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

if (romInput) {
    console.log("romInput found.");

    romInput.addEventListener(
        "change",
        function(event) {
            console.log(
                "FILE INPUT FIRED"
            );

            if (
                event.target.files &&
                event.target.files.length > 0
            ) {
                loadROM(
                    event.target.files[0]
                );
            } else {
                setStatus(
                    "No file selected."
                );
            }
        }
    );
} else {
    console.error(
        "ERROR: Could not find #romInput."
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

            if (romInput) {
                romInput.value = "";
            }

            if (romInfo) {
                romInfo.classList.add(
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

            console.log(
                "ROM removed."
            );
        }
    );
}

if (compileButton) {
    compileButton.addEventListener(
        "click",
        function() {
            if (!currentROMData) {
                setStatus(
                    "No ROM loaded. Select a ROM first."
                );
                return;
            }

            if (!currentROMInfo) {
                setStatus(
                    "ROM information is unavailable."
                );
                return;
            }

            console.log(
                "========== COMPILER INPUT =========="
            );

            console.log(
                "Filename:",
                currentROMInfo.filename
            );

            console.log(
                "Size:",
                currentROMInfo.size
            );

            console.log(
                "Format:",
                currentROMInfo.format
            );

            console.log(
                "ROM data available:",
                currentROMData.length,
                "bytes"
            );

            console.log(
                "===================================="
            );

            setStatus(
                "ROM parsed successfully. SB3 runtime generation is next."
            );
        }
    );
}

setStatus(
    "Select a Genesis ROM to begin."
);

console.log(
    "Genesis2SB3 v0.3 ready."
);
