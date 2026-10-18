
console.log("THE ONE PIECE IS REAL!!!-Whitebeard (Loaded)");
console.log("Genesis2SB3 v0.9 — 68000 instruction decoder prototype");

/*
 * Genesis2SB3 v0.9
 * Builds a Scratch project that fetches and decodes a limited subset
 * of Motorola 68000 instructions from the uploaded Genesis ROM.
 *
 * Supported instructions:
 *   NOP
 *   MOVEQ #imm,Dn
 *   BRA short-displacement
 *
 * Important limitations:
 * - Only the first 64 KiB of ROM data is embedded.
 * - Only a small subset of 68000 instructions is supported.
 * - Genesis memory mapping, VDP graphics, sound, interrupts, and
 *   controller input are not implemented.
 * - This is not yet a playable Genesis emulator.
 *
 * JSZip is required for .sb3 generation.
 */

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

var ROM_EMBED_LIMIT = 65536;
var CPU_STEP_LIMIT = 100;

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

function setStatus(message) {
    if (status) status.textContent = message;
}

function setProgress(percent, message) {
    if (progressBar) progressBar.style.width = percent + "%";
    if (progressPercent) progressPercent.textContent = Math.round(percent) + "%";
    if (progressText) progressText.textContent = message;
}

function escapeXML(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function shorten(value, maxLength) {
    value = String(value || "");
    return value.length > maxLength
        ? value.slice(0, maxLength - 3) + "..."
        : value;
}

function hex(value, digits) {
    if (value == null || !Number.isFinite(value)) return "Unavailable";
    return "0x" + value.toString(16).toUpperCase()
        .padStart(digits || 4, "0");
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

function decodeASCII(bytes, start, length) {
    var output = "";

    for (var i = start; i < Math.min(start + length, bytes.length); i++) {
        var byte = bytes[i];

        output += byte === 0
            ? " "
            : byte >= 32 && byte <= 126
                ? String.fromCharCode(byte)
                : " ";
    }

    return output.replace(/\s+/g, " ").trim();
}

/* =========================================================
   GENESIS ROM ANALYZER
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

    analysis.consoleLooksLikeGenesis = /SEGA/i.test(analysis.consoleName);

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
        analysis.checksumMatches = sum === analysis.storedChecksum;
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
        analysis.findings.push("ROM is shorter than the standard header.");
    }

    if (analysis.headerPresent && !analysis.consoleLooksLikeGenesis) {
        analysis.findings.push(
            "Console identifier does not clearly match a Genesis header."
        );
    }

    if (analysis.checksumMatches === true) {
        analysis.findings.push("Calculated checksum matches stored checksum.");
    } else if (analysis.checksumMatches === false) {
        analysis.findings.push(
            "Checksum differs; the ROM may be modified or unusual."
        );
    }

    if (analysis.declaredSizeMatches === false) {
        analysis.findings.push(
            "Declared ROM size differs from uploaded file size."
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
            "No obvious header issues detected; compatibility is not guaranteed."
        );
    }

    return analysis;
}

function printAnalysis(a) {
    console.group("Genesis2SB3 v0.9 — ROM Analysis");

    [
        "filename",
        "fileSizeFormatted",
        "title",
        "consoleName",
        "copyright",
        "domesticTitle",
        "internationalTitle",
        "serialNumber"
    ].forEach(function (key) {
        console.log(key + ":", a[key]);
    });

    console.log("Initial stack pointer:", hex(a.initialStackPointer, 8));
    console.log("Reset vector:", hex(a.resetVector, 8));
    console.log(
        "Stored checksum:",
        hex(a.storedChecksum, 4),
        "Calculated:",
        hex(a.calculatedChecksum, 4),
        "Match:",
        a.checksumMatches
    );
    console.log("Findings:", a.findings);

    console.groupEnd();
}

/* =========================================================
   FILE LOADING AND UI
   ========================================================= */

function loadROM(file) {
    if (!file) return;

    currentROM = file;
    currentAnalysis = null;

    if (romName) romName.textContent = file.name;
    if (romSize) romSize.textContent = formatBytes(file.size);

    if (romStatus) {
        romStatus.textContent = "ROM loaded. Ready for v0.9 analysis.";
    }

    show(romInfo);
    show(compileButton);

    if (compileButton) {
        compileButton.disabled = false;
        compileButton.removeAttribute("disabled");
        compileButton.classList.remove("disabled", "hidden");
        compileButton.setAttribute("aria-disabled", "false");
    }

    hide(result);
    hide(progressContainer);

    setStatus("ROM loaded. Genesis2SB3 v0.9 is ready.");
    console.log("ROM ready:", file.name, formatBytes(file.size));
}

if (romInput) {
    romInput.addEventListener("change", function () {
        if (this.files && this.files[0]) loadROM(this.files[0]);
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
   SCRATCH PROJECT GENERATOR
   ========================================================= */

function buildScratchProject(analysis, romBytes) {
    var blocks = {};
    var blockCounter = 0;

    var variableIds = {};
    var variableNames = [
        "PC", "Opcode", "Immediate", "Register",
        "Steps", "Halted", "Result",
        "D0", "D1", "D2", "D3", "D4", "D5", "D6", "D7",
        "A0", "A1", "A2", "A3", "A4", "A5", "A6", "A7"
    ];

    variableNames.forEach(function (name) {
        variableIds[name] = "g2s09_var_" + name;
    });

    var romListId = "g2s09_rom_data";
    var registers = [
        "D0", "D1", "D2", "D3", "D4", "D5", "D6", "D7"
    ];

    var embeddedROM = Array.prototype.slice.call(
        romBytes,
        0,
        ROM_EMBED_LIMIT
    ).map(String);

    function newId() {
        blockCounter++;
        return "g2s09_block_" + blockCounter;
    }

    function addBlock(opcode, inputs, fields, topLevel) {
        var blockId = newId();

        blocks[blockId] = {
            opcode: opcode,
            next: null,
            parent: null,
            inputs: inputs || {},
            fields: fields || {},
            shadow: false,
            topLevel: !!topLevel
        };

        if (topLevel) {
            blocks[blockId].x = 30;
            blocks[blockId].y = 30;
        }

        Object.keys(blocks[blockId].inputs).forEach(function (key) {
            var input = blocks[blockId].inputs[key];

            if (
                input &&
                typeof input[1] === "string" &&
                blocks[input[1]]
            ) {
                blocks[input[1]].parent = blockId;
            }
        });

        return blockId;
    }

    function numberLiteral(value) {
        return [1, [4, String(value)]];
    }

    function textLiteral(value) {
        return [1, [10, String(value)]];
    }

    function setInput(parentId, name, value, kind) {
        if (typeof value === "number") {
            blocks[parentId].inputs[name] = numberLiteral(value);
            return;
        }

        if (value && value.literalText !== undefined) {
            blocks[parentId].inputs[name] = textLiteral(value.literalText);
            return;
        }

        if (kind === "bool") {
            blocks[parentId].inputs[name] = [2, value];
        } else {
            blocks[parentId].inputs[name] = [
                3,
                value,
                kind === "text" ? [10, ""] : [4, "0"]
            ];
        }

        if (typeof value === "string" && blocks[value]) {
            blocks[value].parent = parentId;
        }
    }

    function setLiteral(parentId, name, value, kind) {
        blocks[parentId].inputs[name] =
            kind === "text"
                ? textLiteral(value)
                : numberLiteral(value);
    }

    function chain(ids, firstParent) {
        for (var i = 0; i < ids.length; i++) {
            blocks[ids[i]].parent =
                i === 0 ? (firstParent || null) : ids[i - 1];

            blocks[ids[i]].next =
                i + 1 < ids.length ? ids[i + 1] : null;
        }

        return ids.length ? ids[0] : null;
    }

    function variableReporter(name) {
        return addBlock(
            "data_variable",
            {},
            { VARIABLE: [name, variableIds[name]] }
        );
    }

    function listItemReporter(indexReporter) {
        var blockId = addBlock(
            "data_itemoflist",
            {},
            { LIST: ["ROM Data (first 64 KiB)", romListId] }
        );

        setInput(blockId, "INDEX", indexReporter);
        return blockId;
    }

    function math(opcode, left, right) {
        var blockId = addBlock(opcode);

        setInput(blockId, "NUM1", left);
        setInput(blockId, "NUM2", right);

        return blockId;
    }

    function compare(opcode, left, right) {
        var blockId = addBlock(opcode);

        setInput(blockId, "OPERAND1", left, "text");
        setInput(blockId, "OPERAND2", right, "text");

        return blockId;
    }

    function equals(left, right) {
        return compare("operator_equals", left, right);
    }

    function greater(left, right) {
        return compare("operator_gt", left, right);
    }

    function greaterEqual(left, right) {
        return compare("operator_gte", left, right);
    }

    function lessEqual(left, right) {
        return compare("operator_lte", left, right);
    }

    function andCondition(left, right) {
        var blockId = addBlock("operator_and");

        setInput(blockId, "OPERAND1", left, "bool");
        setInput(blockId, "OPERAND2", right, "bool");

        return blockId;
    }

    function setVariable(name, value) {
        var blockId = addBlock(
            "data_setvariableto",
            {},
            { VARIABLE: [name, variableIds[name]] }
        );

        if (typeof value === "number") {
            setLiteral(blockId, "VALUE", value);
        } else if (value && value.literalText !== undefined) {
            setLiteral(blockId, "VALUE", value.literalText, "text");
        } else {
            setInput(blockId, "VALUE", value);
        }

        return blockId;
    }

    function changeVariable(name, value) {
        var blockId = addBlock(
            "data_changevariableby",
            {},
            { VARIABLE: [name, variableIds[name]] }
        );

        setInput(blockId, "VALUE", value);
        return blockId;
    }

    function ifElse(condition, yesIds, noIds) {
        var blockId = addBlock("control_if_else");

        setInput(blockId, "CONDITION", condition, "bool");

        var yes = chain(yesIds || [], blockId);
        var no = chain(noIds || [], blockId);

        blocks[blockId].inputs.SUBSTACK = [2, yes];
        blocks[blockId].inputs.SUBSTACK2 = [2, no];

        return blockId;
    }

    function ifOnly(condition, bodyIds) {
        var blockId = addBlock("control_if");

        setInput(blockId, "CONDITION", condition, "bool");

        var first = chain(bodyIds || [], blockId);
        blocks[blockId].inputs.SUBSTACK = [2, first];

        return blockId;
    }

    function floorReporter(value) {
        var blockId = addBlock("operator_mathop");

        setInput(blockId, "NUM", value);
        blocks[blockId].fields.OPERATOR = ["floor", null];

        return blockId;
    }

    function setPCPlusTwo() {
        return setVariable(
            "PC",
            math("operator_add", variableReporter("PC"), 2)
        );
    }

    /* -----------------------------------------------------
       FETCH
       PC is a zero-based ROM byte offset.
       Scratch lists use one-based indexes, hence PC + 1.
       ----------------------------------------------------- */

    var highIndex = math(
        "operator_add",
        variableReporter("PC"),
        1
    );

    var highByte = listItemReporter(highIndex);

    var lowIndex = math(
        "operator_add",
        variableReporter("PC"),
        2
    );

    var lowByte = listItemReporter(lowIndex);

    var highTimes256 = math(
        "operator_multiply",
        highByte,
        256
    );

    var opcodeValue = math(
        "operator_add",
        highTimes256,
        lowByte
    );

    var fetchOpcode = setVariable("Opcode", opcodeValue);

    /* -----------------------------------------------------
       NOP: 0x4E71
       ----------------------------------------------------- */

    var nop = setPCPlusTwo();

    /* -----------------------------------------------------
       MOVEQ #signed-byte,Dn
       ----------------------------------------------------- */

    var opcodeMinusBase = math(
        "operator_subtract",
        variableReporter("Opcode"),
        0x7000
    );

    var registerNumber = floorReporter(
        math("operator_divide", opcodeMinusBase, 512)
    );

    var setRegisterNumber = setVariable("Register", registerNumber);

    var immediateByte = math(
        "operator_mod",
        variableReporter("Opcode"),
        256
    );

    var setImmediate = setVariable("Immediate", immediateByte);

    var signExtendImmediate = ifOnly(
        greater(variableReporter("Immediate"), 127),
        [
            setVariable(
                "Immediate",
                math(
                    "operator_subtract",
                    variableReporter("Immediate"),
                    256
                )
            )
        ]
    );

    /*
     * Generate a conditional assignment for D0 through D7.
     * Only the selected data register is changed.
     */
    var registerDispatch = [];

    for (var r = registers.length - 1; r >= 0; r--) {
        var selectedRegister = registers[r];

        var assignment = setVariable(
            selectedRegister,
            variableReporter("Immediate")
        );

        var registerMatches = equals(
            variableReporter("Register"),
            r
        );

        registerDispatch = [
            ifElse(
                registerMatches,
                [assignment],
                registerDispatch
            )
        ];
    }

    var moveqBody = [
        setRegisterNumber,
        setImmediate,
        signExtendImmediate
    ].concat(registerDispatch);

    moveqBody.push(setPCPlusTwo());

    /* -----------------------------------------------------
       BRA short displacement
       Target = old PC + 2 + signed displacement
       ----------------------------------------------------- */

    var branchSetImmediate = setVariable(
        "Immediate",
        math(
            "operator_mod",
            variableReporter("Opcode"),
            256
        )
    );

    var branchSignExtend = ifOnly(
        greater(variableReporter("Immediate"), 127),
        [
            setVariable(
                "Immediate",
                math(
                    "operator_subtract",
                    variableReporter("Immediate"),
                    256
                )
            )
        ]
    );

    var branchSetPC = setVariable(
        "PC",
        math(
            "operator_add",
            math(
                "operator_add",
                variableReporter("PC"),
                2
            ),
            variableReporter("Immediate")
        )
    );

    var branchBody = [
        branchSetImmediate,
        branchSignExtend,
        branchSetPC
    ];

    /* -----------------------------------------------------
       Unsupported instructions stop execution.
       ----------------------------------------------------- */

    var unsupportedBody = [
        setVariable("Result", {
            literalText:
                "STOPPED: unsupported opcode. Inspect the Opcode monitor."
        }),
        setVariable("Halted", 1)
    ];

    /* -----------------------------------------------------
       Decode the opcode.
       ----------------------------------------------------- */

    var opcodeReporter = variableReporter("Opcode");

    var isNOP = equals(opcodeReporter, 0x4E71);

    var highOpcodeByte = floorReporter(
        math(
            "operator_divide",
            variableReporter("Opcode"),
            256
        )
    );

    var isMOVEQ = andCondition(
        greaterEqual(highOpcodeByte, 0x70),
        lessEqual(highOpcodeByte, 0x77)
    );

    var branchLowByte = math(
        "operator_mod",
        variableReporter("Opcode"),
        256
    );

    var branchLowIsZero = equals(branchLowByte, 0);

    var branchHighMatches = equals(highOpcodeByte, 0x60);

    /*
     * BRA with an 8-bit displacement of zero uses an
     * extension word, which this version does not support.
     */
    var isShortBRA = andCondition(
        branchHighMatches,
        equals(branchLowIsZero, 0)
    );

    var branchDispatch = ifElse(
        isShortBRA,
        branchBody,
        unsupportedBody
    );

    var moveqDispatch = ifElse(
        isMOVEQ,
        moveqBody,
        [branchDispatch]
    );

    var opcodeDispatch = ifElse(
        isNOP,
        [nop],
        [moveqDispatch]
    );

    var executeInstruction = chain(
        [fetchOpcode, opcodeDispatch]
    );

    /* -----------------------------------------------------
       Check ROM bounds before attempting a fetch.
       ----------------------------------------------------- */

    var pcAtLeastZero = greaterEqual(
        variableReporter("PC"),
        0
    );

    var pcEndWithinROM = lessEqual(
        math(
            "operator_add",
            variableReporter("PC"),
            2
        ),
        embeddedROM.length
    );

    var pcValid = andCondition(
        pcAtLeastZero,
        pcEndWithinROM
    );

    var outOfRangeBody = [
        setVariable("Result", {
            literalText:
                "STOPPED: PC reached outside the embedded ROM range."
        }),
        setVariable("Halted", 1)
    ];

    var executeIfValid = ifElse(
        pcValid,
        [
            changeVariable("Steps", 1),
            executeInstruction
        ],
        outOfRangeBody
    );

    var notHalted = equals(
        variableReporter("Halted"),
        0
    );

    var executionGuard = ifOnly(
        notHalted,
        [executeIfValid]
    );

    var repeat = addBlock("control_repeat", {
        TIMES: [1, [4, String(CPU_STEP_LIMIT)]]
    });

    var repeatBody = chain([executionGuard], repeat);
    blocks[repeat].inputs.SUBSTACK = [2, repeatBody];

    /* -----------------------------------------------------
       Initialize the CPU.
       ----------------------------------------------------- */

    var initialPC =
        analysis.resetVector !== null
            ? analysis.resetVector
            : 0;

    var initialSP =
        analysis.initialStackPointer !== null
            ? analysis.initialStackPointer
            : 0;

    var initialization = [
        setVariable("PC", initialPC),
        setVariable("Opcode", 0),
        setVariable("Immediate", 0),
        setVariable("Register", 0),
        setVariable("Steps", 0),
        setVariable("Halted", 0),
        setVariable("Result", {
            literalText: "CPU running..."
        })
    ];

    registers.forEach(function (name) {
        initialization.push(setVariable(name, 0));
    });

    /*
     * The 68000's A7 is its stack pointer.
     * A0-A6 begin at zero in this prototype.
     */
    for (var a = 0; a < 7; a++) {
        initialization.push(setVariable("A" + a, 0));
    }

    initialization.push(setVariable("A7", initialSP));
    initialization.push(repeat);

    /*
     * If the interpreter did not stop on an unsupported
     * instruction or out-of-range PC, report the safety limit.
     */
    var setLimitResult = setVariable("Result", {
        literalText:
            "Stopped at the 100-instruction safety limit."
    });

    var stillRunning = equals(
        variableReporter("Halted"),
        0
    );

    var limitCheck = ifOnly(
        stillRunning,
        [setLimitResult]
    );

    var sayResult = addBlock("looks_sayforsecs");

    setInput(
        sayResult,
        "MESSAGE",
        variableReporter("Result"),
        "text"
    );

    setLiteral(sayResult, "SECS", 8);

    var hat = addBlock(
        "event_whenflagclicked",
        {},
        {},
        true
    );

    var script = initialization.concat([
        limitCheck,
        sayResult
    ]);

    chain(script, hat);
    blocks[hat].next = script[0];
    blocks[script[0]].parent = hat;

    /* -----------------------------------------------------
       Project data
       ----------------------------------------------------- */

    var variables = {};

    variableNames.forEach(function (name) {
        var initialValue = 0;

        if (name === "PC") initialValue = initialPC;
        if (name === "A7") initialValue = initialSP;

        if (name === "Result") {
            initialValue = "Ready. Click the green flag.";
        }

        variables[variableIds[name]] = [name, initialValue];
    });

    var lists = {};

    lists[romListId] = [
        "ROM Data (first 64 KiB)",
        embeddedROM
    ];

    var monitors = [];

    [
        "PC", "Opcode", "Immediate", "Register",
        "D0", "D1", "D2", "D3",
        "D4", "D5", "D6", "D7",
        "A7", "Steps", "Halted", "Result"
    ].forEach(function (name, index) {
        var isResult = name === "Result";

        monitors.push({
            id: variableIds[name],
            mode: "default",
            opcode: "data_variable",
            params: { VARIABLE: name },
            spriteName: null,
            value: isResult
                ? "Ready. Click the green flag."
                : (name === "PC" ? initialPC : 0),
            width: isResult ? 360 : 100,
            height: 24,
            x: 5,
            y: 5 + index * 26,
            visible: true,
            sliderMin: 0,
            sliderMax: 100,
            isDiscrete: true
        });
    });

    var svg = createDiagnosticSVG(analysis, embeddedROM.length);

    return {
        targets: [{
            isStage: true,
            name: "Stage",
            variables: variables,
            lists: lists,
            broadcasts: {},
            blocks: blocks,
            comments: {},
            currentCostume: 0,

            costumes: [{
                assetId: "ff3f2e0196df3c7d286c4c13e441b003",
                name: "Genesis2SB3 v0.9 CPU",
                bitmapResolution: 1,
                md5ext: "ff3f2e0196df3c7d286c4c13e441b003.svg",
                dataFormat: "svg",
                rotationCenterX: 240,
                rotationCenterY: 180
            }],

            sounds: [],
            volume: 100,
            layerOrder: 0,
            tempo: 60,
            videoTransparency: 50,
            videoState: "off",
            textToSpeechLanguage: null
        }],

        monitors: monitors,
        extensions: [],

        meta: {
            semver: "3.0.0",
            vm: "11.3.0",
            agent: "Genesis2SB3 v0.9 68000 Subset Prototype"
        },

        _diagnosticSVG: svg
    };
}

/* =========================================================
   STAGE COSTUME
   ========================================================= */

function createDiagnosticSVG(analysis, embeddedBytes) {
    var title = analysis
        ? shorten(analysis.title, 36)
        : "Unknown ROM";

    function text(x, y, value, color, size, anchor) {
        return '<text x="' + x + '" y="' + y +
            '" text-anchor="' + (anchor || "start") +
            '" font-family="Arial,sans-serif" font-size="' +
            (size || 12) + '" fill="' + color + '">' +
            escapeXML(value) + "</text>";
    }

    return '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360">' +
        '<rect width="480" height="360" fill="#202020"/>' +
        '<rect x="10" y="10" width="460" height="340" fill="#101010" stroke="#fff" stroke-width="2"/>' +

        text(240, 36, "GENESIS2SB3 v0.9", "#ffffff", 24, "middle") +
        text(240, 56, "68000 INSTRUCTION PROTOTYPE", "#aaaaaa", 11, "middle") +

        text(24, 88, "ROM TITLE", "#ffffff", 12) +
        text(456, 88, title, "#55ff88", 12, "end") +

        text(24, 112, "ROM SIZE", "#ffffff", 12) +
        text(456, 112, analysis.fileSizeFormatted, "#55ff88", 12, "end") +

        text(24, 136, "RESET VECTOR", "#ffffff", 12) +
        text(456, 136, hex(analysis.resetVector, 8), "#55ff88", 12, "end") +

        text(24, 160, "EMBEDDED ROM", "#ffffff", 12) +
        text(456, 160, formatBytes(embeddedBytes), "#55ff88", 12, "end") +

        '<line x1="22" y1="178" x2="458" y2="178" stroke="#444"/>' +

        text(240, 207, "SUPPORTED INSTRUCTIONS", "#ffffff", 15, "middle") +
        text(36, 237, "NOP", "#55ff88", 14) +
        text(36, 259, "MOVEQ #imm,Dn", "#55ff88", 14) +
        text(36, 281, "BRA short displacement", "#55ff88", 14) +

        text(240, 318, "Not a full Genesis emulator", "#ffaa44", 12, "middle") +
        text(240, 335, "CPU execution only — no game graphics or sound", "#aaaaaa", 10, "middle") +

        "</svg>";
}

/* =========================================================
   BUILD .SB3
   ========================================================= */

async function buildSB3() {
    if (!currentROM) {
        setStatus("Please load a Genesis ROM first.");
        return;
    }

    if (typeof JSZip === "undefined") {
        setStatus("ERROR: JSZip is not loaded.");

        console.error(
            "JSZip is undefined. Load jszip.min.js before app.js."
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

        setProgress(15, "Analyzing Genesis header...");

        currentAnalysis = analyzeGenesisROM(romBytes);
        printAnalysis(currentAnalysis);

        if (romStatus) {
            romStatus.textContent =
                "Analyzed: " + currentAnalysis.title;
        }

        setProgress(30, "Preparing ROM data...");

        var embeddedSize = Math.min(
            romBytes.length,
            ROM_EMBED_LIMIT
        );

        console.log(
            "ROM size:",
            romBytes.length,
            "bytes. Embedding:",
            embeddedSize,
            "bytes."
        );

        setProgress(45, "Generating Scratch CPU interpreter...");

        var project = buildScratchProject(
            currentAnalysis,
            romBytes
        );

        var svg = project._diagnosticSVG;
        delete project._diagnosticSVG;

        var projectText = JSON.stringify(project);

        setProgress(60, "Creating JSZip archive...");

        var zip = new JSZip();

        zip.file("project.json", projectText);

        zip.file(
            "ff3f2e0196df3c7d286c4c13e441b003.svg",
            svg
        );

        var blob = await zip.generateAsync(
            {
                type: "blob",
                mimeType: "application/x.scratch.sb3",
                compression: "DEFLATE"
            },
            function (metadata) {
                setProgress(
                    60 + metadata.percent * 0.35,
                    "Building SB3 archive..."
                );
            }
        );

        var archiveBytes = new Uint8Array(
            await blob.arrayBuffer()
        );

        if (
            archiveBytes[0] !== 80 ||
            archiveBytes[1] !== 75
        ) {
            throw new Error(
                "JSZip did not produce a valid ZIP archive."
            );
        }

        console.log(
            "SB3 ZIP signature verified. Archive size:",
            formatBytes(archiveBytes.length)
        );

        if (currentDownloadURL) {
            URL.revokeObjectURL(currentDownloadURL);
        }

        currentDownloadURL = URL.createObjectURL(blob);

        if (downloadButton) {
            downloadButton.onclick = function () {
                if (!currentDownloadURL) return;

                var link = document.createElement("a");

                link.href = currentDownloadURL;
                link.download = "Genesis2SB3-v0.9-CPU-prototype.sb3";

                document.body.appendChild(link);
                link.click();
                link.remove();
            };
        }

        setProgress(100, "Scratch CPU prototype generated.");

        if (resultText) {
            resultText.textContent =
                "Genesis2SB3 v0.9 generated successfully. " +
                "Import the SB3 into Scratch and click the green flag. " +
                "The project fetches instructions from the embedded ROM " +
                "and attempts NOP, MOVEQ, and short BRA. Unsupported " +
                "instructions stop execution. The project embeds " +
                embeddedSize +
                " bytes of ROM data. It is not yet a playable emulator.";
        }

        show(result);

        setStatus(
            "v0.9 SB3 generated. Import it into Scratch to test the CPU."
        );

        console.log(
            "Genesis2SB3 v0.9 generated.",
            "Reset vector:",
            hex(currentAnalysis.resetVector, 8),
            "Embedded ROM bytes:",
            embeddedSize
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
