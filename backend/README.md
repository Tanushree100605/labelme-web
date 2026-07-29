# LabelMe Web - Backend

This is the backend part for our image annotation tool. Handles reading image folders,
sending images to the frontend, and saving the annotation files back into the same
folder (in whichever format the user picked at the start).

No database, no login - as per the requirement. Everything is just stored on disk
next to the images.

## Running it

```
npm install
npm start
```

Runs on port 4000 by default. Change with `PORT` env variable if needed.

## What it does

- Frontend handles all the actual annotation UI (drawing boxes, polygons, format picker screen)
- Backend just does 3 things:
  1. list images from a folder
  2. serve the images to browser
  3. save/load the annotations in the format the user chose

## Endpoints

### Folder stuff
- `GET /api/folder/list?path=<folder>` - lists all images in the folder + checks if they're already annotated
- `GET /api/folder/image?path=<folder>&file=<filename>` - streams the image file

### Format
- `GET /api/format?path=<folder>` - checks if format already locked for this folder (call this before showing format picker)
- `POST /api/format/reset` - body `{folderPath}`, clears the lock if user picked wrong format

### Annotations
- `POST /api/annotations/save` - saves one image's annotations
```
{
  folderPath: "...",
  format: "coco" | "pascal_voc" | "yolo",
  imageName: "img1.jpg",
  imageWidth: 640,
  imageHeight: 480,
  annotations: [
    { label: "dog", type: "bbox", bbox: [x,y,w,h] },
    { label: "cat", type: "polygon", points: [[x1,y1],[x2,y2]...] }
  ]
}
```
Returns 409 error if folder already has a different format saved - one format per folder only.

- `GET /api/annotations/load?path=&format=&imageName=` - gets back saved annotations for one image (so you can reopen an image and see previous boxes). For yolo format also pass `imageWidth` and `imageHeight` as query params since yolo coords are normalized 0-1.

## Files it writes

| format | what gets saved |
|---|---|
| coco | one `annotations.json` shared across the whole folder |
| pascal_voc | one `.xml` per image |
| yolo | one `.txt` per image + shared `classes.txt` |

There's also a hidden `.labelme_format` file that just remembers which format was picked
for that folder. Can delete it manually if you want to reset a folder completely.

## Notes

- Tested all 3 formats manually with sample images, save + load both work
- Added a check so paths can't escape outside the selected folder (basic security thing)
- Still need to figure out with frontend team exact polygon point format they'll send
