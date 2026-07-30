# LabelMe Web - Backend

Backend for the team's image annotation project. Built against the API
contract in `docs/API_CONTRACT.md` (from the frontend side) so it plugs
straight into the existing frontend without any changes needed there.

No database, no login - everything lives on disk in whatever folder the
user points at, exactly like the task needs.

## Running it

```
npm install
npm start
```

Runs on port 8000 by default (matches `API_BASE_URL` in the frontend's
`js/config.js`). Change with `PORT=xxxx npm start` if you need a different
port, just update the frontend config to match.

## How it works

- `POST /api/folders/open` - point it at a folder + pick a format (coco/voc/yolo),
  it scans the folder for images, checks for any existing annotation files in
  that format, and returns everything in one response (images with
  dimensions, classes, and any annotations already on disk).
- Images get served directly as raw bytes via `GET /api/folders/:sessionId/images/:imageName/file`
- Classes get saved separately from `PUT .../classes`
- Boxes for one image get saved via `PUT .../annotations/:imageName` - this
  is where the actual format conversion happens (coco json / voc xml / yolo txt)

Sessions are just kept in memory (a Map) - no db needed since the annotation
files on disk are the real source of truth anyway. Restarting the server is
fine, reopening the same folder just re-reads everything from disk.

## Folder structure

```
src/
  server.js              entry point
  routes/api.js           all the routes
  controllers/
    folderController.js    open folder + serve images
    classController.js     save classes
    annotationController.js save annotations, does the format writing
  formats/
    coco.js               coco json read/write
    voc.js                pascal voc xml read/write
    yolo.js                yolo txt read/write
  utils/
    pathSafety.js          keeps file access inside the selected folder
    sessionStore.js         in-memory session map
```

## Files written per format

| format | files |
|---|---|
| coco | one shared `annotations.json` |
| voc | one `.xml` per image |
| yolo | one `.txt` per image + shared `classes.txt` |

## Notes

- Tested all 3 formats end to end (open, save classes, save boxes, reopen
  and confirm it resumes) plus the error cases (bad classId -> 422, missing
  session -> 404, bad folder path -> 404)
- image-size package is used to read actual image dimensions since the
  frontend needs those for the yolo normalized coords
