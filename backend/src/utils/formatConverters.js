// converts the annotation data coming from frontend into the actual
// export formats. frontend sends something like:
// {
//   imageName: "dog.jpg",
//   imageWidth: 640,
//   imageHeight: 480,
//   annotations: [
//     { label: "dog", type: "bbox", bbox: [x,y,w,h] },
//     { label: "cat", type: "polygon", points: [[x1,y1], [x2,y2], ...] }
//   ]
// }

function toCOCO(payload, existingData) {
  const imageName = payload.imageName;
  const imageWidth = payload.imageWidth;
  const imageHeight = payload.imageHeight;
  const annotations = payload.annotations;

  // if theres already a coco file for this folder we keep adding to it
  // instead of overwriting everything each time
  const base = existingData || {
    info: {
      description: "labelme web annotations",
      version: "1.0",
      year: new Date().getFullYear(),
    },
    licenses: [],
    images: [],
    annotations: [],
    categories: [],
  };

  let imageId;
  const existingImg = base.images.find((img) => img.file_name === imageName);
  if (existingImg) {
    imageId = existingImg.id;
    existingImg.width = imageWidth;
    existingImg.height = imageHeight;
  } else {
    imageId = base.images.length + 1;
    base.images.push({
      id: imageId,
      file_name: imageName,
      width: imageWidth,
      height: imageHeight,
    });
  }

  // clear out old annotations for this image first, otherwise re-saving
  // the same image twice would just keep appending duplicates
  base.annotations = base.annotations.filter((a) => a.image_id !== imageId);

  function getCategoryId(label) {
    let cat = base.categories.find((c) => c.name === label);
    if (!cat) {
      cat = { id: base.categories.length + 1, name: label, supercategory: "object" };
      base.categories.push(cat);
    }
    return cat.id;
  }

  let annIdCounter = 1;
  if (base.annotations.length > 0) {
    annIdCounter = Math.max.apply(null, base.annotations.map((a) => a.id)) + 1;
  }

  for (let i = 0; i < annotations.length; i++) {
    const ann = annotations[i];
    const categoryId = getCategoryId(ann.label);

    let bbox, area, segmentation;

    if (ann.type === "bbox") {
      const x = ann.bbox[0];
      const y = ann.bbox[1];
      const w = ann.bbox[2];
      const h = ann.bbox[3];
      bbox = [x, y, w, h];
      area = w * h;
      segmentation = [[x, y, x + w, y, x + w, y + h, x, y + h]];
    } else if (ann.type === "polygon") {
      const pts = ann.points;
      segmentation = [pts.flat()];

      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      const minX = Math.min.apply(null, xs);
      const minY = Math.min.apply(null, ys);
      const maxX = Math.max.apply(null, xs);
      const maxY = Math.max.apply(null, ys);
      bbox = [minX, minY, maxX - minX, maxY - minY];

      // shoelace formula for polygon area, found this online while
      // figuring out how to calc area for non-rectangular shapes
      let a = 0;
      for (let j = 0; j < pts.length; j++) {
        const k = (j + 1) % pts.length;
        a += pts[j][0] * pts[k][1];
        a -= pts[k][0] * pts[j][1];
      }
      area = Math.abs(a) / 2;
    }

    base.annotations.push({
      id: annIdCounter,
      image_id: imageId,
      category_id: categoryId,
      segmentation: segmentation,
      bbox: bbox,
      area: Math.round(area * 100) / 100,
      iscrowd: 0,
    });
    annIdCounter++;
  }

  return JSON.stringify(base, null, 2);
}

function toPascalVOC(payload) {
  const imageName = payload.imageName;
  const imageWidth = payload.imageWidth;
  const imageHeight = payload.imageHeight;
  const annotations = payload.annotations;

  function escapeXml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  let objectsXml = "";
  for (let i = 0; i < annotations.length; i++) {
    const ann = annotations[i];
    let xmin, ymin, xmax, ymax;

    if (ann.type === "bbox") {
      const x = ann.bbox[0];
      const y = ann.bbox[1];
      const w = ann.bbox[2];
      const h = ann.bbox[3];
      xmin = Math.round(x);
      ymin = Math.round(y);
      xmax = Math.round(x + w);
      ymax = Math.round(y + h);
    } else if (ann.type === "polygon") {
      const pts = ann.points;
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      xmin = Math.round(Math.min.apply(null, xs));
      ymin = Math.round(Math.min.apply(null, ys));
      xmax = Math.round(Math.max.apply(null, xs));
      ymax = Math.round(Math.max.apply(null, ys));
    }

    objectsXml += "\n\t<object>\n\t\t<name>" + escapeXml(ann.label) + "</name>\n\t\t<pose>Unspecified</pose>\n\t\t<truncated>0</truncated>\n\t\t<difficult>0</difficult>\n\t\t<bndbox>\n\t\t\t<xmin>" + xmin + "</xmin>\n\t\t\t<ymin>" + ymin + "</ymin>\n\t\t\t<xmax>" + xmax + "</xmax>\n\t\t\t<ymax>" + ymax + "</ymax>\n\t\t</bndbox>\n\t</object>";
  }

  return '<?xml version="1.0" encoding="UTF-8"?>\n<annotation>\n\t<folder>images</folder>\n\t<filename>' + escapeXml(imageName) + '</filename>\n\t<source>\n\t\t<database>Unknown</database>\n\t</source>\n\t<size>\n\t\t<width>' + imageWidth + '</width>\n\t\t<height>' + imageHeight + '</height>\n\t\t<depth>3</depth>\n\t</size>\n\t<segmented>0</segmented>' + objectsXml + '\n</annotation>';
}

function toYOLO(payload, labelMap) {
  // labelMap looks like { "dog": 0, "cat": 1 } - keeps class ids
  // the same across every image we save in this folder
  const imageWidth = payload.imageWidth;
  const imageHeight = payload.imageHeight;
  const annotations = payload.annotations;

  const updatedMap = Object.assign({}, labelMap);
  let nextId = Object.keys(updatedMap).length;

  const lines = [];
  for (let i = 0; i < annotations.length; i++) {
    const ann = annotations[i];
    if (!(ann.label in updatedMap)) {
      updatedMap[ann.label] = nextId;
      nextId++;
    }
    const classId = updatedMap[ann.label];

    let cx, cy, w, h;

    if (ann.type === "bbox") {
      const x = ann.bbox[0];
      const y = ann.bbox[1];
      const bw = ann.bbox[2];
      const bh = ann.bbox[3];
      cx = (x + bw / 2) / imageWidth;
      cy = (y + bh / 2) / imageHeight;
      w = bw / imageWidth;
      h = bh / imageHeight;
    } else if (ann.type === "polygon") {
      const pts = ann.points;
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      const minX = Math.min.apply(null, xs);
      const minY = Math.min.apply(null, ys);
      const maxX = Math.max.apply(null, xs);
      const maxY = Math.max.apply(null, ys);
      cx = (minX + maxX) / 2 / imageWidth;
      cy = (minY + maxY) / 2 / imageHeight;
      w = (maxX - minX) / imageWidth;
      h = (maxY - minY) / imageHeight;
    }

    lines.push(classId + " " + cx.toFixed(6) + " " + cy.toFixed(6) + " " + w.toFixed(6) + " " + h.toFixed(6));
  }

  return { txt: lines.join("\n"), labelMap: updatedMap };
}

module.exports = { toCOCO, toPascalVOC, toYOLO };
