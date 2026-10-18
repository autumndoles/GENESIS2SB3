console.log("THE ONE PIECE IS REAL!!!-Whitebeard (Loaded)");

/* Genesis2SB3 v0.8
   Scratch-native 68000 subset interpreter self-test.
   JSZip remains responsible for creating the .sb3 archive.
   This is NOT a complete Genesis emulator. */

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

function formatBytes(n) {
    if (n < 1024) return n + " B";
    if (n < 1048576) return (n / 1024).toFixed(2) + " KB";
    return (n / 1048576).toFixed(2) + " MB";
}

function setStatus(s) {
    if (status) status.textContent = s;
}

function setProgress(p, s) {
    if (progressBar) progressBar.style.width = p + "%";
    if (progressPercent) progressPercent.textContent = Math.round(p) + "%";
    if (progressText) progressText.textContent = s;
}

function escapeXML(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function shorten(s, n) {
    s = String(s || "");
    return s.length > n ? s.slice(0, n - 3) + "..." : s;
}

function hex(n, digits) {
    return n == null
        ? "Unavailable"
        : "0x" + n.toString(16).toUpperCase().padStart(digits || 4, "0");
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
    var out = "";

    for (var i = start; i < Math.min(start + length, bytes.length); i++) {
        var b = bytes[i];

        out += b === 0
            ? " "
            : (b >= 32 && b <= 126 ? String.fromCharCode(b) : " ");
    }

    return out.replace(/\s+/g, " ").trim();
}

/* ---------------- ROM analyzer ---------------- */

function analyzeGenesisROM(bytes) {
    var view = new DataView(
        bytes.buffer,
        bytes.byteOffset,
        bytes.byteLength
    );

    var a = {
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

    a.consoleLooksLikeGenesis = /SEGA/i.test(a.consoleName);
    a.calculatedChecksum = null;
    a.checksumMatches = null;

    if (bytes.length >= 0x200) {
        var sum = 0;

        for (var p = 0x200; p < bytes.length; p += 2) {
            sum = (
                sum +
                (bytes[p] << 8) +
                (p + 1 < bytes.length ? bytes[p + 1] : 0)
            ) & 0xFFFF;
        }

        a.calculatedChecksum = sum;
        a.checksumMatches = a.storedChecksum === sum;
    }

    a.declaredROMBytes =
        a.romStart !== null &&
        a.romEnd !== null &&
        a.romEnd >= a.romStart
            ? a.romEnd - a.romStart + 1
            : null;

    a.declaredSizeMatches =
        a.declaredROMBytes === null
            ? null
            : a.declaredROMBytes === bytes.length;

    a.title =
        a.internationalTitle ||
        a.domesticTitle ||
        (currentROM ? currentROM.name : "Unknown ROM");

    a.findings = [];

    if (!a.headerPresent) {
        a.findings.push("ROM is shorter than the standard header area.");
    }

    if (a.headerPresent && !a.consoleLooksLikeGenesis) {
        a.findings.push(
            "Console identifier does not clearly match a Genesis header."
        );
    }

    if (a.checksumMatches === true) {
        a.findings.push(
            "Calculated checksum matches the stored checksum."
        );
    } else if (a.checksumMatches === false) {
        a.findings.push(
            "Checksum differs; the ROM may be modified or unusual."
        );
    }

    if (a.declaredSizeMatches === false) {
        a.findings.push(
            "Declared ROM size differs from the uploaded file size."
        );
    }

    if (a.resetVector !== null && a.resetVector >= bytes.length) {
        a.findings.push(
            "Reset vector is outside the uploaded ROM byte range."
        );
    }

    if (!a.findings.length) {
        a.findings.push(
            "No obvious header issues detected; this is not a compatibility test."
        );
    }

    return a;
}

function printAnalysis(a) {
    console.group("Genesis2SB3 v0.8 — ROM Analysis");

    [
        "filename",
        "fileSizeFormatted",
        "title",
        "consoleName",
        "copyright",
        "domesticTitle",
        "internationalTitle",
        "serialNumber"
    ].forEach(function (k) {
        console.log(k + ":", a[k]);
    });

    console.log(
        "Initial 68000 SP:",
        hex(a.initialStackPointer, 8)
    );

    console.log(
        "68000 reset vector:",
        hex(a.resetVector, 8)
    );

    console.log(
        "Stored checksum:",
        hex(a.storedChecksum, 4),
        "Calculated:",
        hex(a.calculatedChecksum, 4),
        "Match:",
        a.checksumMatches
    );

    console.log(
        "Declared ROM range:",
        hex(a.romStart, 8),
        "to",
        hex(a.romEnd, 8),
        "Declared bytes:",
        a.declaredROMBytes
    );

    console.log("Findings:", a.findings);
    console.groupEnd();
}

/* ---------------- ROM upload interface ---------------- */

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

    if (compileButton) {
        compileButton.disabled = false;
        compileButton.removeAttribute("disabled");
        compileButton.classList.remove("disabled", "hidden");
        compileButton.setAttribute("aria-disabled", "false");
    }

    hide(result);
    hide(progressContainer);

    setStatus("ROM loaded. Genesis2SB3 v0.8 is ready.");

    console.log("ROM ready for analysis:", file.name);
}

if (romInput) {
    romInput.addEventListener("change", function () {
        if (this.files && this.files[0]) {
            loadROM(this.files[0]);
        }
    });
}

if (dropZone) {
    dropZone.addEventListener("dragover", function (e) {
        e.preventDefault();
        dropZone.classList.add("dragging");
    });

    dropZone.addEventListener("dragleave", function () {
        dropZone.classList.remove("dragging");
    });

    dropZone.addEventListener("drop", function (e) {
        e.preventDefault();
        dropZone.classList.remove("dragging");

        if (
            e.dataTransfer &&
            e.dataTransfer.files &&
            e.dataTransfer.files[0]
        ) {
            loadROM(e.dataTransfer.files[0]);
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

/* ---------------- Scratch block generator ----------------
   The self-test program is:
   MOVEQ #5,D0 ; MOVEQ #-3,D1 ; NOP ; BRA -2

   The uploaded ROM is stored as a capped data list.
*/

function buildScratchProject(analysis, romBytes) {
    var blocks = {};
    var blockCounter = 0;

    function id() {
        blockCounter++;
        return "g2s_v08_block_" + blockCounter;
    }

    function add(opcode, inputs, fields, topLevel) {
        var bid = id();

        blocks[bid] = {
            opcode: opcode,
            next: null,
            parent: null,
            inputs: inputs || {},
            fields: fields || {},
            shadow: false,
            topLevel: !!topLevel
        };

        Object.keys(blocks[bid].inputs).forEach(function (key) {
            var input = blocks[bid].inputs[key];

            if (
                input &&
                typeof input[1] === "string" &&
                blocks[input[1]]
            ) {
                blocks[input[1]].parent = bid;
            }
        });

        if (topLevel) {
            blocks[bid].x = 30;
            blocks[bid].y = 30;
        }

        return bid;
    }

    function num(n) {
        return [1, [4, String(n)]];
    }

    function txt(s) {
        return [1, [10, String(s)]];
    }

    function setInput(parent, name, value, kind) {
        if (typeof value === "number") {
            blocks[parent].inputs[name] = [1, [4, String(value)]];
            return;
        }

        if (value && typeof value === "object" &&
            value.literalText !== undefined) {
            blocks[parent].inputs[name] = [
                1,
                [10, String(value.literalText)]
            ];
            return;
        }

        blocks[parent].inputs[name] =
            kind === "bool"
                ? [2, value]
                : [
                    3,
                    value,
                    kind === "text" ? [10, ""] : [4, "0"]
                ];

        if (typeof value === "string" && blocks[value]) {
            blocks[value].parent = parent;
        }
    }

    function setLiteral(parent, name, value, kind) {
        blocks[parent].inputs[name] = [
            1,
            kind === "text"
                ? [10, String(value)]
                : [4, String(value)]
        ];
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

    var variableIds = {};

    [
        "PC", "Opcode",
        "D0", "D1", "D2", "D3",
        "D4", "D5", "D6", "D7",
        "Register", "Immediate",
        "Steps", "Halted", "Result"
    ].forEach(function (name) {
        variableIds[name] = "g2s_v08_var_" + name;
    });

    var cpuListId = "g2s_v08_list_cpu_program";
    var romListId = "g2s_v08_list_rom_data";

    var testProgram = [
        0x70, 0x05,
        0x72, 0xFD,
        0x4E, 0x71,
        0x60, 0xFE
    ];

    var embeddedROM = Array.prototype
        .slice.call(romBytes, 0, 4096)
        .map(String);

    function variable(name) {
        return add(
            "data_variable",
            {},
            { VARIABLE: [name, variableIds[name]] }
        );
    }

    function listItem(listName, listId, indexReporter) {
        var b = add(
            "data_itemoflist",
            {},
            { LIST: [listName, listId] }
        );

        setInput(b, "INDEX", indexReporter);
        return b;
    }

    function binary(opcode, a, b) {
        var r = add(opcode);
        setInput(r, "NUM1", a);
        setInput(r, "NUM2", b);
        return r;
    }

    function compare(opcode, a, b) {
        var r = add(opcode);
        setInput(r, "OPERAND1", a, "text");
        setInput(r, "OPERAND2", b, "text");
        return r;
    }

    function andCondition(a, b) {
        var r = add("operator_and");
        setInput(r, "OPERAND1", a, "bool");
        setInput(r, "OPERAND2", b, "bool");
        return r;
    }

    function setVar(name, reporterId) {
        var b = add(
            "data_setvariableto",
            {},
            { VARIABLE: [name, variableIds[name]] }
        );

        if (typeof reporterId === "number") {
            setLiteral(b, "VALUE", reporterId);
        } else if (
            reporterId &&
            reporterId.literalText !== undefined
        ) {
            setLiteral(b, "VALUE", reporterId.literalText, "text");
        } else {
            setInput(b, "VALUE", reporterId);
        }

        return b;
    }

    function changeVar(name, reporterId) {
        var b = add(
            "data_changevariableby",
            {},
            { VARIABLE: [name, variableIds[name]] }
        );

        setInput(b, "VALUE", reporterId);
        return b;
    }

    function ifElse(condition, yesIds, noIds) {
        var b = add("control_if_else");

        setInput(b, "CONDITION", condition, "bool");

        var yes = chain(yesIds, b);
        var no = chain(noIds, b);

        blocks[b].inputs.SUBSTACK = [2, yes];
        blocks[b].inputs.SUBSTACK2 = [2, no];

        return b;
    }

    function ifOnly(condition, bodyIds) {
        var b = add("control_if");

        setInput(b, "CONDITION", condition, "bool");

        var first = chain(bodyIds, b);

        if (first) {
            blocks[b].inputs.SUBSTACK = [2, first];
        }

        return b;
    }

    function math(op, a, b) {
        return binary(op, a, b);
    }

    function equals(a, b) {
        return compare("operator_equals", a, b);
    }

    function greater(a, b) {
        return compare("operator_gt", a, b);
    }

    function lessEqual(a, b) {
        return compare("operator_lte", a, b);
    }

    /* Fetch the next 16-bit opcode from the test list. */
    var fetchHighIndex = math(
        "operator_add",
        variable("PC"),
        1
    );

    var fetchHigh = listItem(
        "CPU Test Program",
        cpuListId,
        fetchHighIndex
    );

    var highTimes256 = math(
        "operator_multiply",
        fetchHigh,
        256
    );

    var fetchLowIndex = math(
        "operator_add",
        variable("PC"),
        2
    );

    var fetchLow = listItem(
        "CPU Test Program",
        cpuListId,
        fetchLowIndex
    );

    var opcodeExpression = math(
        "operator_add",
        highTimes256,
        fetchLow
    );

    var setOpcode = setVar("Opcode", opcodeExpression);

    /* NOP: advance PC by two bytes. */
    var nopNextPC = math(
        "operator_add",
        variable("PC"),
        2
    );

    var nop = setVar("PC", nopNextPC);

    /* MOVEQ: decode the register and signed immediate. */
    var opMinusBase = math(
        "operator_subtract",
        variable("Opcode"),
        0x7000
    );

    var dividedReg = math(
        "operator_divide",
        opMinusBase,
        512
    );

    var floorReg = add(
        "operator_mathop",
        {
            NUM: [
                3,
                dividedReg,
                [4, "0"]
            ]
        },
        { OPERATOR: ["floor", null] }
    );

    var setReg = setVar("Register", floorReg);

    var lowByte = math(
        "operator_mod",
        variable("Opcode"),
        256
    );

    var setImmediate = setVar("Immediate", lowByte);

    var signedImmediate = math(
        "operator_subtract",
        variable("Immediate"),
        256
    );

    var setNegativeImmediate = setVar(
        "Immediate",
        signedImmediate
    );

    var isNegativeImmediate = greater(
        variable("Immediate"),
        127
    );

    var signExtend = ifOnly(
        isNegativeImmediate,
        [setNegativeImmediate]
    );

    var registerAssignment = null;

    for (var r = 7; r >= 0; r--) {
        var regName = "D" + r;

        var setD = setVar(
            regName,
            variable("Immediate")
        );

        var regMatches = equals(
            variable("Register"),
            r
        );

        registerAssignment = ifElse(
            regMatches,
            [setD],
            registerAssignment ? [registerAssignment] : []
        );
    }

    var moveqNextPC = setVar(
        "PC",
        math(
            "operator_add",
            variable("PC"),
            2
        )
    );

    var moveqChain = [
        setReg,
        setImmediate,
        signExtend,
        registerAssignment,
        moveqNextPC
    ];

    /* BRA with a signed 8-bit displacement. */
    var braSetImmediate = setVar(
        "Immediate",
        math(
            "operator_mod",
            variable("Opcode"),
            256
        )
    );

    var braNegate = setVar(
        "Immediate",
        math(
            "operator_subtract",
            variable("Immediate"),
            256
        )
    );

    var braSign = ifOnly(
        greater(variable("Immediate"), 127),
        [braNegate]
    );

    var braTarget = math(
        "operator_add",
        math(
            "operator_add",
            variable("PC"),
            2
        ),
        variable("Immediate")
    );

    var braSetPC = setVar("PC", braTarget);
    var braChain = [
        braSetImmediate,
        braSign,
        braSetPC
    ];

    var haltSetResult = setVar("Result", {
        literalText: "STOPPED: unsupported opcode"
    });

    var haltSetHalted = setVar("Halted", 1);
    var haltChain = [
        haltSetResult,
        haltSetHalted
    ];

    var opcode = variable("Opcode");

    var isNOP = equals(opcode, 0x4E71);

    var moveqLow = greater(opcode, 0x6FFF);
    var moveqHigh = lessEqual(opcode, 0x7FFF);

    var isMOVEQ = andCondition(
        moveqLow,
        moveqHigh
    );

    var highByte = add(
        "operator_mathop",
        {
            NUM: [
                3,
                math(
                    "operator_divide",
                    variable("Opcode"),
                    256
                ),
                [4, "0"]
            ]
        },
        { OPERATOR: ["floor", null] }
    );

    var isBRAHigh = equals(highByte, 0x60);

    var lowIsZero = equals(
        math(
            "operator_mod",
            variable("Opcode"),
            256
        ),
        0
    );

    var lowNotZero = add(
        "operator_not",
        { OPERAND: [2, lowIsZero] }
    );

    var isBRA = andCondition(
        isBRAHigh,
        lowNotZero
    );

    var dispatchBRA = ifElse(
        isBRA,
        braChain,
        haltChain
    );

    var dispatchMOVEQ = ifElse(
        isMOVEQ,
        moveqChain,
        [dispatchBRA]
    );

    var dispatchNOP = ifElse(
        isNOP,
        [nop],
        [dispatchMOVEQ]
    );

    var executeOpcode = chain([
        setOpcode,
        dispatchNOP
    ]);

    /* Execute with a bounded loop for safety. */
    var haltedCheck = equals(
        variable("Halted"),
        0
    );

    var incrementSteps = changeVar("Steps", 1);

    var executeGuard = ifOnly(
        haltedCheck,
        [
            incrementSteps,
            executeOpcode
        ]
    );

    var repeat = add(
        "control_repeat",
        { TIMES: [1, [4, "20"]] }
    );

    var repeatFirst = chain(
        [executeGuard],
        repeat
    );

    blocks[repeat].inputs.SUBSTACK = [2, repeatFirst];

    var checkD0 = equals(variable("D0"), 5);
    var checkD1 = equals(variable("D1"), -3);

    var bothPass = andCondition(
        checkD0,
        checkD1
    );

    var setPass = setVar("Result", {
        literalText:
            "PASS: D0=5 and D1=-3; 20-step safety limit reached."
    });

    var setFail = setVar("Result", {
        literalText:
            "FAIL: register values did not match expected results."
    });

    var resultCheck = ifElse(
        bothPass,
        [setPass],
        [setFail]
    );

    var sayResult = add("looks_sayforsecs");

    setInput(
        sayResult,
        "MESSAGE",
        variable("Result"),
        "text"
    );

    setLiteral(sayResult, "SECS", 8);

    var setPC0 = setVar("PC", 0);
    var setHalted0 = setVar("Halted", 0);
    var setSteps0 = setVar("Steps", 0);

    var setResultStart = setVar("Result", {
        literalText: "CPU self-test running..."
    });

    var setD0 = setVar("D0", 0);
    var setD1 = setVar("D1", 0);

    var hat = add(
        "event_whenflagclicked",
        {},
        {},
        true
    );

    var script = [
        setPC0,
        setHalted0,
        setSteps0,
        setD0,
        setD1,
        setResultStart,
        repeat,
        resultCheck,
        sayResult
    ];

    chain(script, hat);
    blocks[hat].next = script[0];
    blocks[script[0]].parent = hat;

    /* Scratch variable values use [name, value]. */
    var variables = {};

    Object.keys(variableIds).forEach(function (name) {
        variables[variableIds[name]] = [
            name,
            name === "Result"
                ? "Ready. Click the green flag."
                : 0
        ];
    });

    var lists = {};

    lists[cpuListId] = [
        "CPU Test Program",
        testProgram.map(String)
    ];

    lists[romListId] = [
        "ROM Data (first 4096 bytes)",
        embeddedROM
    ];

    var monitors = [];

    [
        "PC",
        "Opcode",
        "D0",
        "D1",
        "Steps",
        "Halted",
        "Result"
    ].forEach(function (name, i) {
        monitors.push({
            id: variableIds[name],
            mode: "default",
            opcode: "data_variable",
            params: { VARIABLE: name },
            spriteName: null,
            value: name === "Result"
                ? "Ready. Click the green flag."
                : 0,
            width: name === "Result" ? 260 : 100,
            height: 24,
            x: 5,
            y: 5 + i * 26,
            visible: true,
            sliderMin: 0,
            sliderMax: 100,
            isDiscrete: true
        });
    });

    var svg = createDiagnosticSVG(analysis);

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
                name: "Genesis2SB3 v0.8 CPU Test",
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
            agent: "Genesis2SB3 v0.8 Scratch CPU Prototype"
        },
        _diagnosticSVG: svg
    };
}

/* ---------------- Diagnostic stage artwork ---------------- */

function createDiagnosticSVG(a) {
    var title = a
        ? shorten(a.title, 34)
        : "Unknown";

    var checksum =
        !a || a.checksumMatches === null
            ? "UNAVAILABLE"
            : (a.checksumMatches ? "MATCH" : "DIFFERS");

    function t(x, y, s, color, size, anchor) {
        return '<text x="' + x +
            '" y="' + y +
            '" text-anchor="' + (anchor || "start") +
            '" font-family="Arial,sans-serif"' +
            ' font-size="' + (size || 12) +
            '" fill="' + color + '">' +
            escapeXML(s) +
            '</text>';
    }

    return '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360">' +
        '<rect width="480" height="360" fill="#202020"/>' +
        '<rect x="10" y="10" width="460" height="340" fill="#101010" stroke="#fff" stroke-width="2"/>' +
        t(240, 32, "GENESIS2SB3 v0.8", "#fff", 22, "middle") +
        t(240, 50, "SCRATCH-NATIVE CPU SELF-TEST", "#aaa", 10, "middle") +
        t(24, 78, "ROM TITLE", "#fff", 12) +
        t(456, 78, title, "#55ff88", 12, "end") +
        t(24, 102, "ROM SIZE", "#fff", 12) +
        t(456, 102, a ? a.fileSizeFormatted : "Unknown", "#55ff88", 12, "end") +
        t(24, 126, "HEADER", "#fff", 12) +
        t(456, 126, a && a.headerPresent ? "READ" : "UNAVAILABLE", "#55ff88", 12, "end") +
        t(24, 150, "CHECKSUM", "#fff", 12) +
        t(456, 150, checksum, "#ffaa44", 12, "end") +
        '<line x1="22" y1="166" x2="458" y2="166" stroke="#444"/>' +
        t(240, 192, "CPU TEST PROGRAM", "#fff", 16, "middle") +
        t(30, 218, "MOVEQ #5,D0", "#55ff88", 13) +
        t(30, 240, "MOVEQ #-3,D1", "#55ff88", 13) +
        t(30, 262, "NOP", "#55ff88", 13) +
        t(30, 284, "BRA -2 (bounded loop)", "#55ff88", 13) +
        t(240, 322, "Subset interpreter only — not a full Genesis emulator", "#ffaa44", 10, "middle") +
        '</svg>';
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

        setProgress(20, "Analyzing ROM header...");

        currentAnalysis = analyzeGenesisROM(romBytes);
        printAnalysis(currentAnalysis);

        if (romStatus) {
            romStatus.textContent = "Analyzed: " + currentAnalysis.title;
        }

        setProgress(35, "Generating Scratch CPU blocks...");

        var project = buildScratchProject(
            currentAnalysis,
            romBytes
        );

        var svg = project._diagnosticSVG;
        delete project._diagnosticSVG;

        var projectText = JSON.stringify(project, null, 2);

        setProgress(55, "Building JSZip archive...");

        var zip = new JSZip();

        zip.file("project.json", projectText);

        zip.file(
            "ff3f2e0196df3c7d286c4c13e441b003.svg",
            svg
        );

        var blob = await zip.generateAsync({
            type: "blob",
            mimeType: "application/x.scratch.sb3",
            compression: "DEFLATE"
        }, function (meta) {
            setProgress(
                55 + meta.percent * 0.40,
                "Building SB3 archive..."
            );
        });

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
            "SB3 ZIP signature verified: PK. Archive bytes:",
            archiveBytes.length
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
                link.download = "Genesis2SB3-v0.8-cpu-self-test.sb3";

                document.body.appendChild(link);
                link.click();
                link.remove();
            };
        }

        setProgress(
            100,
            "Scratch CPU self-test project generated."
        );

        if (resultText) {
            resultText.textContent =
                "Genesis2SB3 v0.8 generated. Import the SB3 into Scratch, " +
                "click the green flag, and inspect PC, D0, D1, Steps, " +
                "Halted, and Result. Expected registers: D0=5 and D1=-3. " +
                "The uploaded ROM is stored as data; this version does not " +
                "execute the game ROM yet.";
        }

        show(result);

        setStatus(
            "v0.8 SB3 generated. Scratch CPU self-test is ready."
        );

        console.log(
            "Genesis2SB3 v0.8 generated. Embedded ROM prefix:",
            Math.min(romBytes.length, 4096),
            "bytes."
        );
    } catch (err) {
        console.error("Genesis2SB3 build error:", err);

        setStatus("Build failed: " + err.message);

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
