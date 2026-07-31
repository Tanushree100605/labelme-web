// ==============================
// Backend connection
// ==============================

// backend runs on port 8000, see backend/README.md
const API_BASE = "http://localhost:8000/api";

let sessionId = null;
let currentFormat = null; // "coco" | "voc" | "yolo" - locked once folder is opened
let classes = []; // [{id, name}] - kept in sync with backend

// ==============================
// Canvas Setup
// ==============================

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const image = new Image();

// ==============================
// Global Variables
// ==============================

let startX = 0;
let startY = 0;
let currentX = 0;
let currentY = 0;

let isDrawing = false;

let annotations = [];
let selectedBox = -1;

// Stores annotations for every image (keyed by image name now, not blob url)
let imageAnnotations = {};

// Currently opened image
let currentImage = "";
let scale = 1;

// ==============================
// small helpers
// ==============================

function classIdForLabel(label) {
    const found = classes.find((c) => c.name === label);
    return found ? found.id : null;
}

function labelForClassId(id) {
    const found = classes.find((c) => c.id === id);
    return found ? found.name : "unknown";
}

function imageUrlFor(name) {
    return API_BASE + "/folders/" + encodeURIComponent(sessionId) + "/images/" + encodeURIComponent(name) + "/file";
}

// pushes the whole class list to the backend, called whenever classes change
async function syncClassesToBackend() {
    if (!sessionId) return;
    await fetch(API_BASE + "/folders/" + encodeURIComponent(sessionId) + "/classes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classes: classes }),
    });
}

// saves whatever is currently in `annotations` for `currentImage` to the backend
async function saveCurrentImageToBackend() {
    if (!sessionId || currentImage === "") return;

    const boxes = annotations.map((box, i) => ({
        id: i + 1,
        classId: classIdForLabel(box.label),
        x: box.x,
        y: box.y,
        w: box.width,
        h: box.height,
    }));

    const res = await fetch(
        API_BASE + "/folders/" + encodeURIComponent(sessionId) + "/annotations/" + encodeURIComponent(currentImage),
        {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ boxes: boxes }),
        }
    );

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.log("save failed:", err.message);
        alert("Could not save annotation: " + (err.message || "unknown error"));
    }
}

// ==============================
// Load Image
// ==============================

function loadImage(filename) {

    // Save annotations of previous image (both locally and to backend)
    if (currentImage !== "") {
        imageAnnotations[currentImage] = [...annotations];
        saveCurrentImageToBackend();
    }

    currentImage = filename;

    // Load annotations of current image
    annotations = imageAnnotations[filename] || [];
    selectedBox = -1;

    // Highlight selected image
    document.querySelectorAll("#imageList li").forEach(li => {
        li.classList.remove("active");

        if (li.dataset.image === filename) {
            li.classList.add("active");
        }
    });

    image.onload = function () {

        const maxWidth = 950;
        const maxHeight = 650;

        scale = Math.min(
            maxWidth / image.width,
            maxHeight / image.height,
            1
        );

        canvas.width = image.width * scale;
        canvas.height = image.height * scale;

        redraw();
    };

    image.src = imageUrlFor(filename);
}

canvas.addEventListener("mousedown", function (e) {

    startX = e.offsetX;
    startY = e.offsetY;

    currentX = startX;
    currentY = startY;

    isDrawing = true;

});
// ==============================
// Mouse Move
// ==============================

canvas.addEventListener("mousemove", function (e) {

    if (!isDrawing) return;

    currentX = e.offsetX;
    currentY = e.offsetY;

    redraw();

    ctx.strokeStyle = "blue";
    ctx.lineWidth = 2;

    ctx.strokeRect(
        startX,
        startY,
        currentX - startX,
        currentY - startY
    );
});

// ==============================
// Mouse Up
// ==============================

canvas.addEventListener("mouseup", function () {

    if (!isDrawing) return;

    isDrawing = false;

    const width = currentX - startX;
    const height = currentY - startY;

    if (Math.abs(width) < 5 || Math.abs(height) < 5) {

        redraw();
        return;
    }

    const label = document.getElementById("labelSelect").value;

    if (!label) {
        alert("Add a class first.");
        redraw();
        return;
    }

    annotations.push({
         label: label,
          x: startX / scale,
          y: startY / scale,
          width: width / scale,
          height: height / scale

        });

    // Save annotations for current image (locally + backend)
    imageAnnotations[currentImage] = [...annotations];
    saveCurrentImageToBackend();

    selectedBox = annotations.length - 1;

    redraw();

});
// ==============================
// Select Box
// ==============================

canvas.addEventListener("click", function (e) {

    if (isDrawing) return;

    const x = e.offsetX / scale;
    const y = e.offsetY / scale;

    selectedBox = -1;

    for (let i = annotations.length - 1; i >= 0; i--) {

        const box = annotations[i];

        const left = Math.min(box.x, box.x + box.width);
        const right = Math.max(box.x, box.x + box.width);
        const top = Math.min(box.y, box.y + box.height);
        const bottom = Math.max(box.y, box.y + box.height);

        if (
            x >= left &&
            x <= right &&
            y >= top &&
            y <= bottom
        ) {
            selectedBox = i;
            break;
        }

    }

    redraw();

});

// ==============================
// Draw Everything
// ==============================

function redraw() {

    ctx.clearRect(0,0,canvas.width,canvas.height);

    ctx.drawImage(
        image,
        0,
        0,
        canvas.width,
        canvas.height
    );

    annotations.forEach((box, index) => {

        if (index === selectedBox) {
            ctx.strokeStyle = "blue";
            ctx.lineWidth = 3;
        } else {
            ctx.strokeStyle = "red";
            ctx.lineWidth = 2;
        }

       ctx.strokeRect(
        box.x * scale,
        box.y * scale,
        box.width * scale,
        box.height * scale
    );
        ctx.fillStyle = "red";
        ctx.font = "16px Arial";

        ctx.fillText(
            box.label,
            box.x * scale,
            box.y * scale - 5
        );

    });

}

// ==============================
// Add New Class
// ==============================

document.getElementById("newClassBtn").addEventListener("click", function () {

    if (!sessionId) {
        alert("Open a folder first.");
        return;
    }

    const className = prompt("Enter class name:");

    if (className === null) return;

    const newName = className.trim();

    if (newName === "") {
        alert("Class name cannot be empty.");
        return;
    }

    // Check duplicate
    const classList = document.getElementById("classList");
    const items = classList.getElementsByTagName("li");

    for (let i = 0; i < items.length; i++) {

        if (items[i].textContent.toLowerCase() === newName.toLowerCase()) {
            alert("Class already exists.");
            return;
        }

    }

    // Add to class list
    const li = document.createElement("li");
    li.textContent = newName;
    classList.appendChild(li);

    // Add to label dropdown
    const option = document.createElement("option");
    option.value = newName;
    option.textContent = newName;

    document.getElementById("labelSelect").appendChild(option);

    // Select the newly created class
    document.getElementById("labelSelect").value = newName;

    // Track it for backend + assign it an id
    const nextId = classes.length > 0 ? Math.max(...classes.map(c => c.id)) + 1 : 1;
    classes.push({ id: nextId, name: newName });
    syncClassesToBackend();

});

// ==============================
// Delete Selected Box
// ==============================

document.getElementById("deleteBtn").addEventListener("click", function () {

    if (selectedBox === -1) {
        alert("Please select a box first.");
        return;
    }

    annotations.splice(selectedBox, 1);

    imageAnnotations[currentImage] = [...annotations];
    saveCurrentImageToBackend();

    selectedBox = -1;

    redraw();

});

// ==============================
// Load Folder
// ==============================

document.getElementById("loadFolderBtn").addEventListener("click", async function () {

    const folderPath = prompt("Enter the path to the images folder (on the machine running the backend):");
    if (folderPath === null || folderPath.trim() === "") return;

    // format is only asked once, right here, and locked in for the whole folder
    const formatSelect = document.getElementById("formatSelect");
    const rawFormat = formatSelect.value; // "coco" | "pascal" | "yolo" (dropdown values)
    const format = rawFormat === "pascal" ? "voc" : rawFormat; // backend calls it "voc"

    let res, data;
    try {
        res = await fetch(API_BASE + "/folders/open", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: folderPath.trim(), format: format }),
        });
        data = await res.json();
    } catch (err) {
        alert("Could not reach the backend. Is it running on " + API_BASE + " ?");
        return;
    }

    if (!res.ok) {
        alert(data.message || "Could not open that folder.");
        return;
    }

    // lock the format dropdown now that a folder is open
    formatSelect.disabled = true;

    sessionId = data.sessionId;
    currentFormat = data.format;
    classes = data.classes || [];

    // rebuild the class list UI + label dropdown from what the backend returned
    const classListEl = document.getElementById("classList");
    const labelSelectEl = document.getElementById("labelSelect");
    classListEl.innerHTML = "";
    labelSelectEl.innerHTML = "";

    classes.forEach((c) => {
        const li = document.createElement("li");
        li.textContent = c.name;
        classListEl.appendChild(li);

        const option = document.createElement("option");
        option.value = c.name;
        option.textContent = c.name;
        labelSelectEl.appendChild(option);
    });

    // rebuild imageAnnotations from whatever the backend already had saved on disk
    imageAnnotations = {};
    const annotationsByImage = data.annotations || {};
    Object.keys(annotationsByImage).forEach((imgName) => {
        imageAnnotations[imgName] = annotationsByImage[imgName].map((box) => ({
            label: labelForClassId(box.classId),
            x: box.x,
            y: box.y,
            width: box.w,
            height: box.h,
        }));
    });

    // populate the image list
    const imageList = document.getElementById("imageList");
    imageList.innerHTML = "";

    const images = data.images || [];
    if (images.length === 0) {
        alert("No images found in that folder.");
        return;
    }

    images.forEach((img, index) => {

        const li = document.createElement("li");

        li.textContent = img.name;
        li.dataset.image = img.name;

        li.addEventListener("click", function () {
            loadImage(img.name);
        });

        imageList.appendChild(li);

        if (index === 0) {
            currentImage = ""; // so loadImage doesn't try to save a non-existent previous image
            loadImage(img.name);
        }

    });

});

// ==============================
// Save Annotation
// ==============================

document.getElementById("saveBtn").addEventListener("click", function () {

    if (!sessionId) {
        alert("Open a folder first.");
        return;
    }

    if (annotations.length === 0) {
        alert("No annotations to save.");
        return;
    }

    saveCurrentImageToBackend().then(() => {
        alert("Saved to " + currentFormat + " format in the images folder.");
    });

});
