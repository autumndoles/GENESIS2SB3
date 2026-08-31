console.log("Genesis2SB3 v0.2.2 loaded");

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

function setStatus(message) {
if (statusBox) {
statusBox.textContent = message;
}

```
console.log(message);
```

}

function formatBytes(bytes) {
if (bytes < 1024) {
return bytes + " B";
}

```
if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(2) + " KB";
}

return (bytes / 1024 / 1024).toFixed(2) + " MB";
```

}

function loadROM(file) {
if (!file) {
setStatus("No ROM selected.");
return;
}

```
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
        currentROMData = new Uint8Array(event.target.result);

        console.log(
            "ROM loaded successfully:",
            currentROMData.length,
            "bytes"
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

    } catch (error) {
        console.error(error);

        currentROM = null;
        currentROMData = null;

        setStatus(
            "Failed to process ROM: " +
            error.message
        );
    }
};

reader.onerror = function() {
    currentROM = null;
    currentROMData = null;

    setStatus("Failed to read the ROM file.");
};

reader.readAsArrayBuffer(file);
```

}

if (romInput) {
console.log("romInput found.");

```
romInput.addEventListener("change", function(event) {
    console.log("FILE INPUT FIRED");

    if (
        event.target.files &&
        event.target.files.length > 0
    ) {
        loadROM(event.target.files[0]);
    } else {
        setStatus("No file selected.");
    }
});
```

} else {
console.error(
"ERROR: Could not find #romInput."
);
}

if (dropZone) {
dropZone.addEventListener("dragover", function(event) {
event.preventDefault();
dropZone.classList.add("dragging");
});

```
dropZone.addEventListener("dragleave", function() {
    dropZone.classList.remove("dragging");
});

dropZone.addEventListener("drop", function(event) {
    event.preventDefault();

    dropZone.classList.remove("dragging");

    var files = event.dataTransfer.files;

    if (files && files.length > 0) {
        loadROM(files[0]);
    }
});
```

}

if (removeRom) {
removeRom.addEventListener("click", function() {
currentROM = null;
currentROMData = null;

```
    if (romInput) {
        romInput.value = "";
    }

    if (romInfo) {
        romInfo.classList.add("hidden");
    }

    if (romStatus) {
        romStatus.textContent = "No ROM selected";
    }

    if (compileButton) {
        compileButton.disabled = true;
    }

    setStatus(
        "Select a Genesis ROM to begin."
    );
});
```

}

if (compileButton) {
compileButton.addEventListener("click", function() {
if (!currentROMData) {
setStatus(
"No ROM loaded. Select a ROM first."
);
return;
}

```
    setStatus(
        "ROM loaded successfully. Compiler coming next."
    );

    console.log(
        "Ready for compilation:",
        currentROM.name
    );

    console.log(
        "ROM bytes:",
        currentROMData.length
    );
});
```

}

setStatus(
"Select a Genesis ROM to begin."
);

console.log(
"Genesis2SB3 v0.2.2 ready."
);
