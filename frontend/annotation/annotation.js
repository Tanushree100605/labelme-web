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

// Stores annotations for every image
let imageAnnotations = {};

// Currently opened image
let currentImage = "";
let scale = 1;
// ==============================
// Load Image
// ==============================

function loadImage(filename) {

    // Save annotations of previous image
    if (currentImage !== "") {
        imageAnnotations[currentImage] = [...annotations];
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

    image.src = filename;
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

    annotations.push({
         label: label,
          x: startX / scale,
          y: startY / scale,
          width: width / scale,
          height: height / scale
        
        });

    // Save annotations for current image
    imageAnnotations[currentImage] = [...annotations];

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

// Load first image
loadImage("sample.jpg");

// ==============================
// Add New Class
// ==============================

document.getElementById("newClassBtn").addEventListener("click", function () {

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

    selectedBox = -1;

    redraw();

});

// ==============================
// Load Folder
// ==============================

const folderInput = document.getElementById("folderInput");

document.getElementById("loadFolderBtn").addEventListener("click", function () {

    folderInput.click();

});

folderInput.addEventListener("change", function (event) {

    const files = Array.from(event.target.files);

    const imageFiles = files.filter(file =>
        file.type.startsWith("image/")
    );

    const imageList = document.getElementById("imageList");

    imageList.innerHTML = "";

    if (imageFiles.length === 0) {
        alert("No images found.");
        return;
    }

    imageFiles.forEach((file, index) => {

        const imageURL = URL.createObjectURL(file);

        const li = document.createElement("li");

        li.textContent = file.name;
        li.dataset.image = imageURL;

        li.addEventListener("click", function () {

            loadImage(imageURL);

        });

        imageList.appendChild(li);

        // Load first image automatically
        if (index === 0) {
            loadImage(imageURL);
        }

    });

});

// ==============================
// Save Annotation
// ==============================

document.getElementById("saveBtn").addEventListener("click", function () {

    const format = document.getElementById("formatSelect").value;

    if (annotations.length === 0) {
        alert("No annotations to save.");
        return;
    }

    let content = "";
    let fileName = "";

    switch (format) {

        case "coco":
            content = exportCOCO();
            fileName = "annotation.json";
            break;

        case "pascal":
            content = exportPascal();
            fileName = "annotation.xml";
            break;

        case "yolo":
            content = exportYOLO();
            fileName = "annotation.txt";
            break;

        default:
            alert("Invalid format.");
            return;
    }

    const blob = new Blob([content], {
        type: "text/plain"
    });

    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);

    link.download = fileName;

    link.click();

});

function exportCOCO() {

    const data = {
        images: [
            {
                id: 1,
                file_name: currentImage
            }
        ],
        annotations: [],
        categories: []
    };

    let categoryMap = {};
    let categoryId = 1;

    annotations.forEach((box, index) => {

        if (!(box.label in categoryMap)) {

            categoryMap[box.label] = categoryId;

            data.categories.push({
                id: categoryId,
                name: box.label
            });

            categoryId++;

        }

        data.annotations.push({

            id: index + 1,

            image_id: 1,

            category_id: categoryMap[box.label],

            bbox: [

                box.x,

                box.y,

                box.width,

                box.height

            ]

        });

    });

    return JSON.stringify(data, null, 4);

}

function exportPascal() {

    let xml = `<annotation>\n`;

    xml += `<filename>${currentImage}</filename>\n`;

    annotations.forEach(box => {

        xml += `<object>\n`;

        xml += `<name>${box.label}</name>\n`;

        xml += `<bndbox>\n`;

        xml += `<xmin>${box.x}</xmin>\n`;

        xml += `<ymin>${box.y}</ymin>\n`;

        xml += `<xmax>${box.x + box.width}</xmax>\n`;

        xml += `<ymax>${box.y + box.height}</ymax>\n`;

        xml += `</bndbox>\n`;

        xml += `</object>\n`;

    });

    xml += `</annotation>`;

    return xml;

}


function exportYOLO() {

    let txt = "";

    annotations.forEach(box => {

        const xCenter = (box.x + box.width / 2) / canvas.width;

        const yCenter = (box.y + box.height / 2) / canvas.height;

        const width = box.width / canvas.width;

        const height = box.height / canvas.height;

        txt += `0 ${xCenter} ${yCenter} ${width} ${height}\n`;

    });

    return txt;

}

