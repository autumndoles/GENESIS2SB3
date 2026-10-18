
console.log("THE ONE PIECE IS REAL!!!-Whitebeard (Loaded)");

/* =========================================================
   Genesis2SB3 v0.7
   ROM Header Analyzer + Scratch SB3 Diagnostic Builder

   IMPORTANT:
   - Keep JSZip loaded before this file.
   - This version analyzes ROM metadata.
   - It does NOT emulate the Genesis hardware yet.
========================================================= */

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
        progressPercent.textContent = Math.round(percent) + "%";
    }

    if (progressText) {
        progressText.textContent = message;
    }
}

function readU16BE(view, offset) {
    if (offset < 0 || offset + 2 > view.byteLength) {
        return null;
    }

    return view.getUint16(offset, false);
}

function readU32BE(view, offset) {
    if (offset < 0 || offset + 4 > view.byteLength) {
        return null;
    }

    return view.getUint32(offset, false);
}

function hex(value, digits) {
    if (value === null || value === undefined) {
        return "Unavailable";
    }

    return "0x" + value.toString(16).toUpperCase()
        .padStart(digits || 4, "0");
}

function decodeASCII(bytes, start, length) {
    if (start < 0 || start >= bytes.length) {
        return "";
    }

    var end = Math.min(start + length, bytes.length);
    var output = "";

    for (var i = start; i < end; i++) {
        var value = bytes[i];

        if (value === 0) {
            output += " ";
        } else if (value >= 32 && value <= 126) {
            output += String.fromCharCode(value);
        } else {
            output += " ";
        }
    }

    return output.replace(/\s+/g, " ").trim();
}

function escapeXML(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function shorten(text, maxLength) {
    text = String(text || "");

    if (text.length <= maxLength) {
        return text;
    }

    return text.slice(0, maxLength - 3) + "...";
}


/* =========================================================
   ROM HEADER ANALYZER
========================================================= */

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
        largeEnoughForHeader: bytes.length >= 0x200
    };

    /*
       The standard Mega Drive / Genesis header begins at 0x100.
       CPU reset vectors are located at the start of the ROM.
    */

    analysis.initialStackPointer = readU32BE(view, 0x0000);
    analysis.resetVector = readU32BE(view, 0x0004);

    analysis.consoleName = decodeASCII(bytes, 0x100, 16);
    analysis.copyright = decodeASCII(bytes, 0x110, 16);
    analysis.domesticTitle = decodeASCII(bytes, 0x120, 48);
    analysis.internationalTitle = decodeASCII(bytes, 0x150, 48);
    analysis.serialNumber = decodeASCII(bytes, 0x180, 14);

    analysis.storedChecksum = readU16BE(view, 0x18E);
    analysis.romStart = readU32BE(view, 0x1A0);
    analysis.romEnd = readU32BE(view, 0x1A4);
    analysis.ramStart = readU32BE(view, 0x1A8);
    analysis.ramEnd = readU32BE(view, 0x1AC);

    analysis.headerPresent = bytes.length >= 0x200;

    analysis.consoleLooksLikeGenesis =
        /SEGA/i.test(analysis.consoleName);

    /*
       Calculate the usual Genesis checksum:
       add 16-bit big-endian words starting at 0x200,
       keeping the result modulo 65536.

       If the ROM has an odd number of bytes, the final
       unpaired byte is treated as the high byte.
    */

    var calculatedChecksum = 0;

    if (bytes.length >= 0x200) {
        for (var offset = 0x200; offset < bytes.length; offset += 2) {
            var high = bytes[offset];
            var low = offset + 1 < bytes.length
                ? bytes[offset + 1]
                : 0;

            calculatedChecksum =
                (calculatedChecksum + (high << 8) + low) & 0xFFFF;
        }

        analysis.calculatedChecksum = calculatedChecksum;
        analysis.checksumMatches =
            analysis.storedChecksum === calculatedChecksum;
    } else {
        analysis.calculatedChecksum = null;
        analysis.checksumMatches = null;
    }

    /*
       Header range fields are addresses, not file offsets.
       A mismatch can indicate padding, a modified ROM,
       unusual hardware, or incorrect metadata.
    */

    if (
        analysis.romStart !== null &&
        analysis.romEnd !== null &&
        analysis.romEnd >= analysis.romStart
    ) {
        analysis.declaredROMBytes =
            analysis.romEnd - analysis.romStart + 1;
    } else {
        analysis.declaredROMBytes = null;
    }

    analysis.declaredSizeMatches =
        analysis.declaredROMBytes !== null
            ? analysis.declaredROMBytes === bytes.length
            : null;

    analysis.title =
        analysis.internationalTitle ||
        analysis.domesticTitle ||
        currentROM.name;

    analysis.findings = [];

    if (!analysis.headerPresent) {
        analysis.findings.push(
            "ROM is shorter than the standard header area."
        );
    }

    if (analysis.headerPresent && !analysis.consoleLooksLikeGenesis) {
        analysis.findings.push(
            "Console identifier does not clearly match a Genesis header."
        );
    }

    if (analysis.checksumMatches === true) {
        analysis.findings.push("Calculated checksum matches the stored checksum.");
    } else if (analysis.checksumMatches === false) {
        analysis.findings.push(
            "Checksum differs. The ROM may be modified or use unusual data."
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
            "Reset vector is outside the uploaded ROM's byte range."
        );
    }

    if (analysis.findings.length === 0) {
        analysis.findings.push(
            "No obvious header issues detected. This is not a full compatibility test."
        );
    }

    return analysis;
}

function printAnalysis(analysis) {
    console.group("Genesis2SB3 v0.7 — ROM Analysis");

    console.log("Filename:", analysis.filename);
    console.log("File size:", analysis.fileSizeFormatted);
    console.log("Title:", analysis.title);
    console.log("Console identifier:", analysis.consoleName);
    console.log("Copyright:", analysis.copyright);
    console.log("Domestic title:", analysis.domesticTitle || "(empty)");
    console.log("International title:", analysis.internationalTitle || "(empty)");
    console.log("Serial number:", analysis.serialNumber || "(empty)");

    console.log(
        "Initial 68000 stack pointer:",
        hex(analysis.initialStackPointer, 8)
    );

    console.log(
        "68000 reset vector:",
        hex(analysis.resetVector, 8)
    );

    console.log(
        "Stored checksum:",
        hex(analysis.storedChecksum, 4)
    );

    console.log(
        "Calculated checksum:",
        hex(analysis.calculatedChecksum, 4)
    );

    console.log("Checksum matches:", analysis.checksumMatches);

    console.log("Declared ROM start:", hex(analysis.romStart, 8));
    console.log("Declared ROM end:", hex(analysis.romEnd, 8));

    console.log(
        "Declared ROM size:",
        analysis.declaredROMBytes === null
            ? "Unavailable"
            : formatBytes(analysis.declaredROMBytes)
    );

    console.log(
        "Declared size matches file:",
        analysis.declaredSizeMatches
    );

    console.log("Findings:", analysis.findings);

    console.groupEnd();
}


/* =========================================================
   ROM LOADING
========================================================= */

function loadROM(file) {
    if (!file) {
        return;
    }

    currentROM = file;
    currentAnalysis = null;

    if (romName) {
        romName.textContent = file.name;
    }

    if (romSize) {
        romSize.textContent = formatBytes(file.size);
    }

    if (romStatus) {
        romStatus.textContent = "ROM loaded. Ready to analyze.";
    }

    show(romInfo);

    if (compileButton) {
        compileButton.disabled = false;
        compileButton.removeAttribute("disabled");
        compileButton.classList.remove("disabled", "hidden");
        compileButton.setAttribute("aria-disabled", "false");
    }

    hide(result);
    hide(progressContainer);

    setStatus("ROM loaded. Genesis2SB3 v0.7 is ready.");

    console.log("ROM ready for analysis:", file.name);
}

if (romInput) {
    romInput.addEventListener("change", function () {
        if (this.files && this.files.length > 0) {
            loadROM(this.files[0]);
        }
    });
}


/* =========================================================
   DRAG AND DROP
========================================================= */

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


/* =========================================================
   REMOVE ROM
========================================================= */

if (removeRom) {
    removeRom.addEventListener("click", function () {
        currentROM = null;
        currentAnalysis = null;

        if (romInput) {
            romInput.value = "";
        }

        hide(romInfo);
        hide(compileButton);
        hide(result);
        hide(progressContainer);

        if (compileButton) {
            compileButton.disabled = true;
            compileButton.setAttribute("disabled", "disabled");
            compileButton.setAttribute("aria-disabled", "true");
        }

        if (currentDownloadURL) {
            URL.revokeObjectURL(currentDownloadURL);
            currentDownloadURL = null;
        }

        setStatus("No ROM loaded.");
    });
}


/* =========================================================
   DIAGNOSTIC SVG
========================================================= */

function createDiagnosticSVG(analysis) {
    var filename = currentROM ? currentROM.name : "No ROM";
    var filesize = currentROM ? formatBytes(currentROM.size) : "0 B";

    var title = analysis
        ? shorten(analysis.title, 35)
        : "Waiting for analysis";

    var checksum = analysis && analysis.checksumMatches !== null
        ? (analysis.checksumMatches ? "MATCH" : "DIFFERS")
        : "UNAVAILABLE";

    var consoleID = analysis
        ? shorten(analysis.consoleName || "Unknown", 25)
        : "Unknown";

    var resetVector = analysis
        ? hex(analysis.resetVector, 8)
        : "Unavailable";

    var stackPointer = analysis
        ? hex(analysis.initialStackPointer, 8)
        : "Unavailable";

    var headerStatus = analysis && analysis.headerPresent
        ? "READ"
        : "TOO SHORT";

    var checksumColor = analysis && analysis.checksumMatches === true
        ? "#55ff88"
        : "#ffaa44";

    function svgText(x, y, text, color, size, anchor) {
        return '<text x="' + x + '" y="' + y +
            '" text-anchor="' + (anchor || "start") +
            '" font-family="Arial, sans-serif" font-size="' +
            (size || 12) + '" fill="' + (color || "#ffffff") +
            '">' + escapeXML(text) + "</text>";
    }

    var lines = "";

    lines += svgText(240, 28, "GENESIS2SB3 v0.7", "#ffffff", 22, "middle");
    lines += svgText(240, 45, "ROM HEADER ANALYZER", "#aaaaaa", 10, "middle");

    lines += '<line x1="22" y1="54" x2="458" y2="54" stroke="#555555"/>';

    lines += svgText(24, 72, "ROM", "#ffffff", 11);
    lines += svgText(456, 72, shorten(filename, 44), "#55ff88", 11, "end");

    lines += svgText(24, 90, "SIZE", "#ffffff", 11);
    lines += svgText(456, 90, filesize, "#55ff88", 11, "end");

    lines += svgText(24, 108, "GAME TITLE", "#ffffff", 11);
    lines += svgText(456, 108, title, "#55ff88", 11, "end");

    lines += '<line x1="22" y1="118" x2="458" y2="118" stroke="#444444"/>';

    lines += svgText(24, 137, "CONSOLE", "#ffffff", 11);
    lines += svgText(456, 137, consoleID, "#55ff88", 11, "end");

    lines += svgText(24, 157, "HEADER", "#ffffff", 11);
    lines += svgText(456, 157, headerStatus, "#55ff88", 11, "end");

    lines += svgText(24, 177, "STORED CHECKSUM", "#ffffff", 11);
    lines += svgText(
        456, 177,
        analysis ? hex(analysis.storedChecksum, 4) : "Unavailable",
        "#ffffff", 11, "end"
    );

    lines += svgText(24, 197, "CALCULATED CHECKSUM", "#ffffff", 11);
    lines += svgText(
        456, 197,
        analysis ? hex(analysis.calculatedChecksum, 4) : "Unavailable",
        "#ffffff", 11, "end"
    );

    lines += svgText(24, 217, "CHECKSUM STATUS", "#ffffff", 11);
    lines += svgText(456, 217, checksum, checksumColor, 11, "end");

    lines += '<line x1="22" y1="227" x2="458" y2="227" stroke="#444444"/>';

    lines += svgText(24, 246, "68000 INITIAL SP", "#ffffff", 11);
    lines += svgText(456, 246, stackPointer, "#55ff88", 11, "end");

    lines += svgText(24, 266, "68000 RESET VECTOR", "#ffffff", 11);
    lines += svgText(456, 266, resetVector, "#55ff88", 11, "end");

    lines += svgText(24, 290, "ROM METADATA: ANALYZED", "#55ff88", 11);
    lines += svgText(24, 307, "68000 / Z80 / VDP / YM2612: NOT EMULATED", "#ffaa44", 10);

    lines += svgText(
        240, 339,
        "Metadata analysis is not a compatibility guarantee.",
        "#888888", 9, "middle"
    );

    return '<svg xmlns="http://www.w3.org/2000/svg" ' +
        'width="480" height="360" viewBox="0 0 480 360">' +
        '<rect width="480" height="360" fill="#202020"/>' +
        '<rect x="10" y="10" width="460" height="340" ' +
        'fill="#101010" stroke="#ffffff" stroke-width="2"/>' +
        lines +
        "</svg>";
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
                        assetId: "ff3f2e0196df3c7d286c4c13e441b003",
                        name: "Genesis2SB3 Diagnostic",
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
                videoState: "off",

                textToSpeechLanguage: null
            }
        ],

        monitors: [],
        extensions: [],

        meta: {
            semver: "3.0.0",
            vm: "11.3.0",
            agent: "Genesis2SB3 v0.7"
        }
    };
}


/* =========================================================
   BUILD SB3
========================================================= */

async function buildSB3() {
    if (!currentROM) {
        setStatus("Please load a Genesis ROM first.");
        return;
    }

    if (typeof JSZip === "undefined") {
        setStatus("ERROR: JSZip is not loaded.");

        console.error(
            "JSZip is undefined. Make sure jszip.min.js " +
            "is loaded before app.js."
        );

        return;
    }

    try {
        if (compileButton) {
            compileButton.disabled = true;
        }

        show(progressContainer);
        hide(result);

        setProgress(5, "Reading ROM...");

        var romBuffer = await currentROM.arrayBuffer();
        var romBytes = new Uint8Array(romBuffer);

        setProgress(20, "Analyzing Genesis header...");

        currentAnalysis = analyzeGenesisROM(romBytes);
        printAnalysis(currentAnalysis);

        if (romStatus) {
            romStatus.textContent =
                "Analyzed: " + currentAnalysis.title;
        }

        setProgress(35, "Creating Scratch project...");

        var project = createProjectJSON();
        var projectText = JSON.stringify(project, null, 2);

        setProgress(50, "Creating diagnostic screen...");

        var svg = createDiagnosticSVG(currentAnalysis);

        /*
           Keep using JSZip. Do not manually create ZIP headers
           or replace this with a homemade ZIP implementation.
        */

        console.log("JSZip loaded:", typeof JSZip);

        var zip = new JSZip();

        zip.file("project.json", projectText);

        zip.file(
            "ff3f2e0196df3c7d286c4c13e441b003.svg",
            svg
        );

        setProgress(65, "Generating SB3 with JSZip...");

        var blob = await zip.generateAsync(
            {
                type: "blob",
                mimeType: "application/x.scratch.sb3",
                compression: "STORE"
            },
            function (metadata) {
                var percent = 65 + metadata.percent * 0.30;

                setProgress(
                    percent,
                    "Building SB3 archive..."
                );
            }
        );

        setProgress(96, "Verifying archive...");

        var bytes = new Uint8Array(await blob.arrayBuffer());

        console.log("Generated SB3 size:", bytes.length);
        console.log("First four bytes:", Array.from(bytes.slice(0, 4)));

        if (bytes[0] !== 80 || bytes[1] !== 75) {
            throw new Error("JSZip did not produce a valid ZIP archive.");
        }

        console.log("ZIP signature verified: PK");

        if (currentDownloadURL) {
            URL.revokeObjectURL(currentDownloadURL);
        }

        currentDownloadURL = URL.createObjectURL(blob);

        if (downloadButton) {
            downloadButton.onclick = function () {
                if (!currentDownloadURL) {
                    return;
                }

                var link = document.createElement("a");

                link.href = currentDownloadURL;
                link.download = "Genesis2SB3-v0.7-analyzer.sb3";

                document.body.appendChild(link);
                link.click();
                link.remove();
            };
        }

        setProgress(100, "SB3 generated successfully.");

        if (resultText) {
            resultText.textContent =
                "Genesis2SB3 v0.7 generated successfully. " +
                "ROM header analysis is available in the browser console. " +
                "Detected title: " + currentAnalysis.title +
                ". Checksum: " +
                (currentAnalysis.checksumMatches === null
                    ? "unavailable"
                    : currentAnalysis.checksumMatches
                        ? "matches"
                        : "differs") +
                ". This project is a diagnostic screen, not an emulator.";
        }

        show(result);

        setStatus(
            "SB3 generated. ROM analysis complete."
        );

        console.log("Genesis2SB3 v0.7 generated.");

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


/* =========================================================
   COMPILE BUTTON
========================================================= */

if (compileButton) {
    compileButton.addEventListener("click", buildSB3);
}
