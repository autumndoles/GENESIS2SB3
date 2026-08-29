const VERSION = "0.1.1";

const SUPPORTED_EXTENSIONS = [
"bin",
"gen",
"md",
"smd"
];

/* =========================================================
FORCE ROM FILE TYPES
========================================================= */

if (romInput) {
romInput.setAttribute(
"accept",
".bin,.gen,.md,.smd,application/octet-stream"
);
}

/* =========================================================
ROM INPUT
========================================================= */

romInput.addEventListener(
"change",
event => {
const file =
event.target.files[0];

```
    if (file) {
        loadROM(file);
    }
}
```

);

dropZone.addEventListener(
"dragover",
event => {
event.preventDefault();

```
    dropZone.classList.add(
        "dragging"
    );
}
```

);

dropZone.addEventListener(
"dragleave",
() => {
dropZone.classList.remove(
"dragging"
);
}
);

dropZone.addEventListener(
"drop",
event => {
event.preventDefault();

```
    dropZone.classList.remove(
        "dragging"
    );

    const file =
        event.dataTransfer.files[0];

    if (file) {
        loadROM(file);
    }
}
```

);

/* =========================================================
LOAD ROM
========================================================= */

async function loadROM(file) {
resetCompilation();

```
/*
 * Don't trust the browser's MIME type.
 * Genesis ROMs commonly have weird or empty
 * MIME types.
 */
const extension =
    file.name
        .split(".")
        .pop()
        .toLowerCase();

if (
    !SUPPORTED_EXTENSIONS
        .includes(extension)
) {
    setStatus(
        `Unsupported ROM type: .${extension}`,
        "error"
    );

    return;
}

if (file.size === 0) {
    setStatus(
        "The selected ROM is empty.",
        "error"
    );

    return;
}

try {
    setStatus(
        `Reading ${file.name}...`
    );

    let data =
        new Uint8Array(
            await file.arrayBuffer()
        );

    /*
     * IMPORTANT:
     *
     * .md is normally a raw Genesis ROM.
     * Only .smd should automatically go through
     * SMD deinterleaving.
     *
     * Previously the code attempted to identify
     * SMD based on the contents of every ROM,
     * which could corrupt perfectly valid .md files.
     */
    let wasSMD = false;

    if (
        extension === "smd"
    ) {
        if (
            isDefinitelySMD(data)
        ) {
            data =
                deinterleaveSMD(data);

            wasSMD = true;
        } else {
            /*
             * Some .smd files are actually raw ROMs.
             * Don't destroy them if there isn't a
             * recognizable SMD structure.
             */
            console.warn(
                "File is .smd but does not look strongly like an SMD image. Treating it as raw ROM."
            );
        }
    }

    /*
     * Raw Genesis ROMs are normally even-sized.
     * A 512-byte SMD header is only stripped when
     * the file was explicitly identified as SMD.
     */
    currentROM = file;
    currentROMData = data;

    currentROMInfo =
        parseGenesisROM(
            currentROMData
        );

    displayROMInfo();

    if (
        currentROMInfo.headerFound
    ) {
        const title =
            currentROMInfo.title ||
            "Untitled Genesis ROM";

        let message =
            `${title} loaded successfully.`;

        if (wasSMD) {
            message +=
                " SMD format converted.";
        }

        setStatus(
            message,
            "success"
        );
    } else {
        /*
         * Don't reject a ROM merely because
         * its header isn't standard.
         *
         * Homebrew and unusual cartridges can
         * have nonstandard layouts.
         */
        setStatus(
            `${file.name} loaded, but no standard SEGA header was found.`,
            "warning"
        );
    }

    compileButton.disabled =
        false;

} catch (error) {
    console.error(
        "ROM loading error:",
        error
    );

    currentROM = null;
    currentROMData = null;
    currentROMInfo = null;

    setStatus(
        `Could not read ROM: ${error.message}`,
        "error"
    );
}
```

}

/* =========================================================
SMD DETECTION
========================================================= */

function isDefinitelySMD(data) {
/*
* An SMD image normally has:
*
*   512-byte header
*   16 KiB interleaved blocks
*
* This deliberately requires all of those
* properties before modifying the file.
*/

```
if (
    data.length <
    512 + 16384
) {
    return false;
}

if (
    (data.length - 512) %
    16384 !== 0
) {
    return false;
}

/*
 * Check the SMD header's first bytes.
 *
 * Typical SMD files contain:
 *
 * byte 0: 0x03
 * byte 1: 0x00
 *
 * Not every dump follows this perfectly,
 * so this is combined with the size check.
 */
const headerLooksRight =
    data[0] === 0x03 &&
    data[1] === 0x00;

/*
 * Check whether the first 16 KiB block
 * actually looks interleaved.
 */
const block =
    data.subarray(
        512,
        512 + 16384
    );

let firstHalfNonZero = 0;
let secondHalfNonZero = 0;

for (
    let i = 0;
    i < 8192;
    i++
) {
    if (
        block[i] !== 0
    ) {
        firstHalfNonZero++;
    }

    if (
        block[8192 + i] !== 0
    ) {
        secondHalfNonZero++;
    }
}

const dataLooksUseful =
    firstHalfNonZero > 100 &&
    secondHalfNonZero > 100;

return (
    headerLooksRight &&
    dataLooksUseful
);
```

}

/* =========================================================
SMD DEINTERLEAVER
========================================================= */

function deinterleaveSMD(data) {
if (
data.length <= 512
) {
return data;
}

```
const body =
    data.slice(512);

const output =
    new Uint8Array(
        body.length
    );

for (
    let blockStart = 0;
    blockStart < body.length;
    blockStart += 16384
) {
    const blockEnd =
        Math.min(
            blockStart + 16384,
            body.length
        );

    const blockSize =
        blockEnd - blockStart;

    if (
        blockSize < 2
    ) {
        output.set(
            body.subarray(
                blockStart,
                blockEnd
            ),
            blockStart
        );

        continue;
    }

    const half =
        Math.floor(
            blockSize / 2
        );

    for (
        let i = 0;
        i < half;
        i++
    ) {
        /*
         * SMD:
         *
         * first half  = odd bytes
         * second half = even bytes
         */
        output[
            blockStart + i * 2
        ] =
            body[
                blockStart +
                half +
                i
            ];

        output[
            blockStart +
            i * 2 +
            1
        ] =
            body[
                blockStart +
                i
            ];
    }
}

return output;

}
