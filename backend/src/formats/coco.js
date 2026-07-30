// converts our session data (generic boxes with classId) to/from coco json.
// coco is one shared annotations.json for the whole folder

const COCO_FILENAME = "annotations.json";

// builds the full coco doc from a session (classes, images, annotations map)
function buildCoco(session) {
  const doc = {
    info: { description: "labelme web annotations", year: new Date().getFullYear() },
    licenses: [],
    images: [],
    annotations: [],
    categories: [],
  };

  session.images.forEach((img, idx) => {
    doc.images.push({
      id: idx + 1,
      file_name: img.name,
      width: img.width,
      height: img.height,
    });
  });

  session.classes.forEach((cls) => {
    doc.categories.push({ id: cls.id, name: cls.name, supercategory: "object" });
  });

  let annId = 1;
  session.images.forEach((img, idx) => {
    const imageId = idx + 1;
    const boxes = session.annotations[img.name] || [];
    boxes.forEach((box) => {
      doc.annotations.push({
        id: annId,
        image_id: imageId,
        category_id: box.classId,
        bbox: [box.x, box.y, box.w, box.h],
        area: box.w * box.h,
        iscrowd: 0,
      });
      annId++;
    });
  });

  return doc;
}

// reads an existing annotations.json back into { classes, annotationsByImage }
// used when a folder is reopened so previous work isnt lost
function parseCoco(json) {
  const classes = (json.categories || []).map((c) => ({ id: c.id, name: c.name }));
  const imageIdToName = {};
  (json.images || []).forEach((img) => {
    imageIdToName[img.id] = img.file_name;
  });

  const annotationsByImage = {};
  (json.annotations || []).forEach((ann) => {
    const imgName = imageIdToName[ann.image_id];
    if (!imgName) return;
    if (!annotationsByImage[imgName]) annotationsByImage[imgName] = [];
    const [x, y, w, h] = ann.bbox;
    annotationsByImage[imgName].push({
      id: ann.id,
      classId: ann.category_id,
      x,
      y,
      w,
      h,
    });
  });

  return { classes, annotationsByImage };
}

module.exports = { COCO_FILENAME, buildCoco, parseCoco };
