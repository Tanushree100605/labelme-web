// no database allowed per the task, so sessions just live in memory.
// restarting the server clears everything - thats expected/fine here,
// annotation files on disk are the actual source of truth anyway

const sessions = new Map();
let classIdCounter = 1;

function createSession(sessionId, data) {
  sessions.set(sessionId, data);
}

function getSession(sessionId) {
  return sessions.get(sessionId);
}

function nextClassId() {
  const id = classIdCounter;
  classIdCounter++;
  return id;
}

// bumps the counter up if we load in classes with higher ids from
// an existing annotations.json, so we dont hand out a duplicate id later
function bumpClassIdCounter(usedId) {
  if (usedId >= classIdCounter) {
    classIdCounter = usedId + 1;
  }
}

module.exports = { createSession, getSession, nextClassId, bumpClassIdCounter };
