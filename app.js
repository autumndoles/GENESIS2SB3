
console.log("THE ONE PIECE IS REAL!!!-Whitebeard (Loaded)");

/* Genesis2SB3 v0.8.1
   Scratch import diagnostic.
   JSZip creates the .sb3 archive.
   This version does not emulate the Genesis CPU yet.
*/

"use strict";

/* ---------------- Interface ---------------- */

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
var currentAnalysis = null;
var currentDownloadURL = null;

function show(el) {
    if (el) el.classList.remove("hidden");
}

function hide(el) {
    if (el) el.classList.add("hidden");
}

function setStatus(message) {
    if (status) status.textContent = message;
}

function setProgress(percent, message) {
    if (progressBar) progressBar.style.width = percent + "%";
    if (progressPercent) progressPercent.textContent =
        Math.round(percent) + "%";
    if (progressText) progressText.textContent = message;
}

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(2) + " KB";
    return (bytes / 1048576).toFixed(2) + " MB";
}

function escapeXML(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function decodeASCII(bytes, start, length) {
    var result = "";

    for (
        var i = start;
        i < Math.min(start + length, bytes.length);
        i++
    ) {
        var value = bytes[i];
        result += value >= 32 && value <= 126
            ? String.fromCharCode(value)
            : " ";
    }

    return result.replace(/\s+/g, " ").trim();
}

function readU16(view, offset) {
    return offset + 2 <= view.byteLength
        ? view.getUint16(offset, false)
        : null;
}

function readU32(view, offset) {
    return offset + 4 <= view.byteLength
        ? view.getUint32(offset, false)
        : null;
}

function hex(value, digits) {
    if (value === null || value === undefined) {
        return "Unavailable";
    }

    return "0x" + value.toString(16).toUpperCase()
        .padStart(digits || 4, "0");
}

/* ---------------- ROM analyzer ---------------- */

function analyzeGenesisROM(bytes) {
    var view = new DataView(
        bytes.buffer,
        bytes.byteOffset,
        bytes.byteLength
    );

    var analysis = {
        filename: currentROM ? currentROM.name : "Unknown ROM",
        fileSize: bytes.length,
        fileSizeFormatted: formatBytes(bytes.length),
        headerPresent: bytes.length >= 0x200,

        initialStackPointer: readU32(view, 0),
        resetVector: readU32(view, 4),

        consoleName: decodeASCII(bytes, 0x100, 16),
        copyright: decodeASCII(bytes, 0x110, 16),
        domesticTitle: decodeASCII(bytes, 0x120, 48),
        internationalTitle: decodeASCII(bytes, 0x150, 48),
        serialNumber: decodeASCII(bytes, 0x180, 14),

        storedChecksum: readU16(view, 0x18E),
        romStart: readU32(view, 0x1A0),
        romEnd: readU32(view, 0x1A4),
        ramStart: readU32(view, 0x1A8),
        ramEnd: readU32(view, 0x1AC)
    };

    analysis.consoleLooksLikeGenesis =
        /SEGA/i.test(analysis.consoleName);

    analysis.calculatedChecksum = null;
    analysis.checksumMatches = null;

    if (bytes.length >= 0x200) {
        var sum = 0;

        for (var p = 0x200; p < bytes.length; p += 2) {
            sum = (
                sum +
                (bytes[p] << 8) +
                (p + 1 < bytes.length ? bytes[p + 1] : 0)
            ) & 0xFFFF;
        }

        analysis.calculatedChecksum = sum;
        analysis.checksumMatches =
            analysis.storedChecksum === sum;
    }

    analysis.declaredROMBytes =
        analysis.romStart !== null &&
        analysis.romEnd !== null &&
        analysis.romEnd >= analysis.romStart
            ? analysis.romEnd - analysis.romStart + 1
            : null;

    analysis.declaredSizeMatches =
        analysis.declaredROMBytes === null
            ? null
            : analysis.declaredROMBytes === bytes.length;

    analysis.title =
        analysis.internationalTitle ||
        analysis.domesticTitle ||
        analysis.filename;

    analysis.findings = [];

    if (!analysis.headerPresent) {
        analysis.findings.push(
            "ROM is shorter than the standard header area."
        );
    }

    if (
        analysis.headerPresent &&
        !analysis.consoleLooksLikeGenesis
    ) {
        analysis.findings.push(
            "Console identifier does not clearly match Genesis."
        );
    }

    if (analysis.checksumMatches === true) {
        analysis.findings.push(
            "Calculated checksum matches the stored checksum."
        );
    } else if (analysis.checksumMatches === false) {
        analysis.findings.push(
            "Checksum differs; the ROM may be modified or unusual."
        );
    }

    if (analysis.declaredSizeMatches === false) {
        analysis.findings.push(
            "Declared ROM size differs from the uploaded file size."
        );
    }

    if (
        analysis.resetVector !== null &&
        analysis.resetVector >= bytes.length
    ) {
        analysis.findings.push(
            "Reset vector is outside the uploaded ROM byte range."
        );
    }

    if (!analysis.findings.length) {
        analysis.findings.push(
            "No obvious header issues detected. This is not an emulator test."
        );
    }

    return analysis;
}

function printAnalysis(a) {
    console.group("Genesis2SB3 v0.8.1 — ROM Analysis");

    console.log("Filename:", a.filename);
    console.log("ROM size:", a.fileSizeFormatted);
    console.log("Title:", a.title);
    console.log("Console:", a.consoleName);
    console.log("Copyright:", a.copyright);
    console.log("Serial:", a.serialNumber);
    console.log("Initial 68000 SP:", hex(a.initialStackPointer, 8));
    console.log("68000 reset vector:", hex(a.resetVector, 8));

    console.log(
        "Stored checksum:", hex(a.storedChecksum),
        "Calculated:", hex(a.calculatedChecksum),
        "Match:", a.checksumMatches
    );

    console.log("Findings:", a.findings);
    console.groupEnd();
}

/* ---------------- ROM upload controls ---------------- */

function loadROM(file) {
    if (!file) return;

    currentROM = file;
    currentAnalysis = null;

    if (romName) romName.textContent = file.name;
    if (romSize) romSize.textContent = formatBytes(file.size);

    if (romStatus) {
        romStatus.textContent = "ROM loaded. Ready to analyze.";
    }

    show(romInfo);
    show(compileButton);
    hide(result);
    hide(progressContainer);

    if (compileButton) {
        compileButton.disabled = false;
        compileButton.removeAttribute("disabled");
        compileButton.setAttribute("aria-disabled", "false");
    }

    setStatus("ROM loaded. Genesis2SB3 v0.8.1 is ready.");
    console.log("ROM ready:", file.name);
}

if (romInput) {
    romInput.addEventListener("change", function () {
        if (this.files && this.files[0]) {
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
            event.dataTransfer.files[0]
        ) {
            loadROM(event.dataTransfer.files[0]);
        }
    });

    dropZone.addEventListener("click", function () {
        if (romInput) romInput.click();
    });
}

if (removeRom) {
    removeRom.addEventListener("click", function () {
        currentROM = null;
        currentAnalysis = null;

        if (romInput) romInput.value = "";

        hide(romInfo);
        hide(compileButton);
        hide(result);
        hide(progressContainer);

        if (compileButton) compileButton.disabled = true;

        if (currentDownloadURL) {
            URL.revokeObjectURL(currentDownloadURL);
            currentDownloadURL = null;
        }

        setStatus("No ROM loaded.");
    });
}

/* ---------------- Scratch project generator ---------------- */

/*
  This generator intentionally uses a small, straightforward block graph.

  The costume's asset ID is the MD5 of the exact SVG string below.
  This avoids the previous mismatch between the costume's asset ID
  and the file stored inside the SB3 archive.
*/

var COSTUME_ID = "1d7d7f4176384cd6f8bdfab6c87abf8f";
var COSTUME_FILE = COSTUME_ID + ".svg";

var DIAGNOSTIC_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360">' +
    '<rect width="480" height="360" fill="#202020"/>' +
    '<rect x="10" y="10" width="460" height="340" fill="#101010" stroke="#ffffff" stroke-width="2"/>' +
    '<text x="240" y="42" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" fill="#ffffff">GENESIS2SB3</text>' +
    '<text x="240" y="70" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" fill="#55ff88">SCRATCH PROJECT IMPORT TEST</text>' +
    '<text x="24" y="120" font-family="Arial,sans-serif" font-size="14" fill="#ffffff">This project was generated by Genesis2SB3.</text>' +
    '<text x="24" y="150" font-family="Arial,sans-serif" font-size="14" fill="#ffffff">Click the green flag to run the diagnostic.</text>' +
    '<text x="240" y="320" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" fill="#ffaa44">Import test only — not a Genesis emulator</text>' +
    '</svg>';

function buildScratchProject(analysis, romBytes) {
    var blocks = {};
    var counter = 0;

    function makeId() {
        counter++;
        return "g2s081_" + counter;
    }

    var variableIds = {
        D0: "g2s081_var_d0",
        D1: "g2s081_var_d1",
        Result: "g2s081_var_result"
    };

    var romListId = "g2s081_list_rom";

    function addBlock(opcode, fields, inputs, topLevel) {
        var id = makeId();

        blocks[id] = {
            opcode: opcode,
            next: null,
            parent: null,
            inputs: inputs || {},
            fields: fields || {},
            shadow: false,
            topLevel: !!topLevel
        };

        if (topLevel) {
            blocks[id].x = 30;
            blocks[id].y = 30;
        }

        return id;
    }

    function setVariableBlock(name, value) {
        return addBlock(
            "data_setvariableto",
            {
                VARIABLE: [name, variableIds[name]]
            },
            {
                VALUE: [1, [4, String(value)]]
            },
            false
        );
    }

    function setTextVariableBlock(name, value) {
        return addBlock(
            "data_setvariableto",
            {
                VARIABLE: [name, variableIds[name]]
            },
            {
                VALUE: [1, [10, String(value)]]
            },
            false
        );
    }

    function chain(ids) {
        for (var i = 0; i < ids.length; i++) {
            blocks[ids[i]].parent = i === 0 ? null : ids[i - 1];
            blocks[ids[i]].next =
                i + 1 < ids.length ? ids[i + 1] : null;
        }

        return ids.length ? ids[0] : null;
    }

    var flag = addBlock(
        "event_whenflagclicked",
        {},
        {},
        true
    );

    var setD0 = setVariableBlock("D0", 5);
    var setD1 = setVariableBlock("D1", -3);

    var setResult = setTextVariableBlock(
        "Result",
        "PASS: import diagnostic ran. D0=5, D1=-3. CPU not emulated."
    );

    var say = addBlock(
        "looks_sayforsecs",
        {},
        {
            MESSAGE: [
                1,
                [10, "PASS: import diagnostic ran. D0=5, D1=-3."]
            ],
            SECS: [1, [4, "8"]]
        },
        false
    );

    var script = [setD0, setD1, setResult, say];

    for (var i = 0; i < script.length; i++) {
        blocks[script[i]].parent =
            i === 0 ? flag : script[i - 1];

        blocks[script[i]].next =
            i + 1 < script.length ? script[i + 1] : null;
    }

    blocks[flag].next = script[0];
    blocks[script[0]].parent = flag;

    var variables = {};
    variables[variableIds.D0] = ["D0", 0];
    variables[variableIds.D1] = ["D1", 0];
    variables[variableIds.Result] = [
        "Result",
        "Ready. Click the green flag."
    ];

    var embeddedROM = Array.prototype
        .slice.call(romBytes, 0, 4096)
        .map(function (byte) {
            return String(byte);
        });

    var lists = {};
    lists[romListId] = [
        "ROM Data (first 4096 bytes)",
        embeddedROM
    ];

    return {
        targets: [
            {
                isStage: true,
                name: "Stage",
                variables: variables,
                lists: lists,
                broadcasts: {},
                blocks: blocks,
                comments: {},
                currentCostume: 0,
                costumes: [
                    {
                        assetId: COSTUME_ID,
                        name: "Genesis2SB3 Diagnostic",
                        bitmapResolution: 1,
                        md5ext: COSTUME_FILE,
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
            agent: "Genesis2SB3 v0.8.1 Import Diagnostic"
        }
    };
}

/* ---------------- SB3 generation ---------------- */

async function buildSB3() {
    if (!currentROM) {
        setStatus("Please load a Genesis ROM first.");
        return;
    }

    if (typeof JSZip === "undefined") {
        setStatus("ERROR: JSZip is not loaded.");
        console.error(
            "Load jszip.min.js before app.js."
        );
        return;
    }

    try {
        if (compileButton) compileButton.disabled = true;

        show(progressContainer);
        hide(result);

        setProgress(5, "Reading ROM...");

        var buffer = await currentROM.arrayBuffer();
        var romBytes = new Uint8Array(buffer);

        setProgress(20, "Analyzing ROM header...");

        currentAnalysis = analyzeGenesisROM(romBytes);
        printAnalysis(currentAnalysis);

        if (romStatus) {
            romStatus.textContent =
                "Analyzed: " + currentAnalysis.title;
        }

        setProgress(40, "Creating Scratch diagnostic...");

        var project = buildScratchProject(
            currentAnalysis,
            romBytes
        );

        var projectText = JSON.stringify(project);

        setProgress(60, "Building SB3 archive with JSZip...");

        var zip = new JSZip();

        zip.file("project.json", projectText);
        zip.file(COSTUME_FILE, DIAGNOSTIC_SVG);

        var blob = await zip.generateAsync({
            type: "blob",
            mimeType: "application/x.scratch.sb3",
            compression: "DEFLATE"
        }, function (metadata) {
            setProgress(
                60 + metadata.percent * 0.35,
                "Building SB3 archive..."
            );
        });

        // Check that the ZIP container is present.
        var archiveBytes = new Uint8Array(
            await blob.arrayBuffer()
        );

        if (
            archiveBytes.length < 4 ||
            archiveBytes[0] !== 0x50 ||
            archiveBytes[1] !== 0x4B
        ) {
            throw new Error(
                "The generated file is not a valid ZIP archive."
            );
        }

        // Parse the JSON again before offering the download.
        JSON.parse(projectText);

        if (currentDownloadURL) {
            URL.revokeObjectURL(currentDownloadURL);
        }

        currentDownloadURL = URL.createObjectURL(blob);

        if (downloadButton) {
            downloadButton.onclick = function () {
                if (!currentDownloadURL) return;

                var link = document.createElement("a");
                link.href = currentDownloadURL;
                link.download =
                    "Genesis2SB3-v0.8.1-import-test.sb3";

                document.body.appendChild(link);
                link.click();
                link.remove();
            };
        }

        setProgress(100, "Scratch diagnostic generated.");

        if (resultText) {
            resultText.textContent =
                "Genesis2SB3 v0.8.1 created an SB3 diagnostic project. " +
                "Import it into Scratch and click the green flag. " +
                "The project should set D0=5 and D1=-3, display a PASS " +
                "message, and include the first 4096 ROM bytes in a list. " +
                "This diagnostic does not execute the uploaded game ROM.";
        }

        show(result);
        setStatus(
            "SB3 generated. Import the diagnostic into Scratch to test it."
        );

        console.log(
            "Genesis2SB3 diagnostic generated.",
            "Embedded ROM bytes:",
            Math.min(romBytes.length, 4096),
            "Archive bytes:",
            archiveBytes.length
        );
    } catch (error) {
        console.error("Genesis2SB3 build error:", error);

        setStatus("Build failed: " + error.message);

        if (progressText) {
            progressText.textContent = "Build failed.";
        }
    } finally {
        if (compileButton && currentROM) {
            compileButton.disabled = false;
        }
    }
}

if (compileButton) {
    compileButton.addEventListener("click", buildSB3);
}

setStatus("Genesis2SB3 v0.8.1 loaded. Select a ROM to begin.");
