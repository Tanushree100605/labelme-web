// pascal voc format - one xml file per image

function vocFilenameFor(baseName) {
  return baseName + ".xml";
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// boxes here are already { classId, x, y, w, h }, classNameOf resolves the name
function buildVocXml(opts) {
  const imageName = opts.imageName;
  const folderName = opts.folderName;
  const width = opts.width;
  const height = opts.height;
  const boxes = opts.boxes;
  const classNameOf = opts.classNameOf;

  let objects = "";
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    const name = classNameOf(b.classId) || "unknown";
    const xmin = Math.round(b.x);
    const ymin = Math.round(b.y);
    const xmax = Math.round(b.x + b.w);
    const ymax = Math.round(b.y + b.h);

    objects +=
      "\n\t<object>\n\t\t<name>" +
      escapeXml(name) +
      "</name>\n\t\t<pose>Unspecified</pose>\n\t\t<truncated>0</truncated>\n\t\t<difficult>0</difficult>\n\t\t<bndbox>\n\t\t\t<xmin>" +
      xmin +
      "</xmin>\n\t\t\t<ymin>" +
      ymin +
      "</ymin>\n\t\t\t<xmax>" +
      xmax +
      "</xmax>\n\t\t\t<ymax>" +
      ymax +
      "</ymax>\n\t\t</bndbox>\n\t</object>";
  }

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n<annotation>\n\t<folder>' +
    escapeXml(folderName) +
    "</folder>\n\t<filename>" +
    escapeXml(imageName) +
    "</filename>\n\t<size>\n\t\t<width>" +
    width +
    "</width>\n\t\t<height>" +
    height +
    "</height>\n\t\t<depth>3</depth>\n\t</size>\n\t<segmented>0</segmented>" +
    objects +
    "\n</annotation>"
  );
}

// reads an existing xml back - returns boxes with the class NAME (not id yet,
// caller has to map name -> id since xml only stores the name)
function parseVocXml(xmlText) {
  const boxes = [];
  const objectRegex = /<object>([\s\S]*?)<\/object>/g;
  let match;
  while ((match = objectRegex.exec(xmlText)) !== null) {
    const block = match[1];
    const nameMatch = /<name>(.*?)<\/name>/.exec(block);
    const xminMatch = /<xmin>(.*?)<\/xmin>/.exec(block);
    const yminMatch = /<ymin>(.*?)<\/ymin>/.exec(block);
    const xmaxMatch = /<xmax>(.*?)<\/xmax>/.exec(block);
    const ymaxMatch = /<ymax>(.*?)<\/ymax>/.exec(block);

    if (!nameMatch || !xminMatch || !yminMatch || !xmaxMatch || !ymaxMatch) continue;

    const xmin = parseFloat(xminMatch[1]);
    const ymin = parseFloat(yminMatch[1]);
    const xmax = parseFloat(xmaxMatch[1]);
    const ymax = parseFloat(ymaxMatch[1]);

    boxes.push({
      className: nameMatch[1],
      x: xmin,
      y: ymin,
      w: xmax - xmin,
      h: ymax - ymin,
    });
  }
  return { boxes };
}

module.exports = { vocFilenameFor, buildVocXml, parseVocXml };
