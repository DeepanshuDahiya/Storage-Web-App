import express from "express";
import fs, { writeFile } from "node:fs/promises";
import path from "node:path";
import { baseDir } from "../app.js";
import idValidation from "../Middlewares/idValidationMiddleware.js";
import { ObjectId } from "mongodb";

const router = express.Router();

// path traversal denied logic
function resolveSafePath(userPath = "") {
  const decoded = decodeURIComponent(userPath || "");
  const fullPath = path.resolve(baseDir, decoded);

  if (!fullPath.startsWith(baseDir)) {
    throw new Error("Access denied");
  }

  return fullPath;
}

router.param("id", idValidation);
router.param("parentDirId", idValidation);

// get Directory content
router.get("{/:id}", async (req, res) => {
  const { uid: userId } = req.cookies;
  const uid = new ObjectId(userId);
  const db = req.db;
  const user = req.user;
  const id = req.params.id ? new ObjectId(req.params.id) : user.rootDir;

  const dirCollection = db.collection("folders");
  const filesCollection = db.collection("files");

  // let folderData = foldersData.find((folder) => folder.id === id);
  let folderData = await dirCollection.findOne({ _id: new ObjectId(id) });

  // ✅ handle folder not found
  if (!folderData) {
    return res.status(404).json({ error: "Folder not found" });
  } else if (!folderData.userId.equals(uid)) {
    return res.status(403).json({ error: "Access Forbidden" });
  }

  try {
    // ✅ map + remove undefined
    const files = await Promise.all(
      folderData.files.map((fileId) =>
        filesCollection.findOne({ _id: new ObjectId(fileId) }),
      ),
    );

    const folders = await Promise.all(
      folderData.folders.map((folderId) =>
        dirCollection.findOne({ _id: new ObjectId(folderId) }),
      ),
    );

    return res.json({ ...folderData, files, folders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// make dir
router.post("{/:parentDirId}", async (req, res) => {
  const { uid: userId } = req.cookies;
  const uid = new ObjectId(userId);
  const { name: dirName } = req.body || "Untitled";

  const user = req.user;
  const parentDirId = req.params.parentDirId
    ? new ObjectId(req.params.parentDirId)
    : user.rootDir;

  try {
    const folderCollection = req.db.collection("folders");
    const folderResult = await folderCollection.insertOne({
      name: dirName,
      parentDirId,
      userId: uid,
      files: [],
      folders: [],
    });

    const folderId = folderResult.insertedId;

    const parentFolder = await folderCollection.updateOne(
      { _id: parentDirId },
      {
        $push: {
          folders: folderId,
        },
      },
    );

    return res.status(201).json({ message: "Folder created", folderId });
  } catch (err) {
    return res.json({ error: err.message });
  }
});

// Rename Directory
router.patch("{/:id}", async (req, res) => {
  const { id } = req.params;
  const { uid: userId } = req.cookies;
  const uid = new ObjectId(userId);
  const name = req.body.name;
  const user = req.user;

  const foldersCollection = req.db.collection("folders");

  let result;

  try {
    if (!id) {
      result = await foldersCollection.updateOne(
        { _id: new ObjectId(user.rootDir), userId: uid },
        { $set: { name: newName } },
      );
    } else {
      result = await foldersCollection.updateOne(
        { _id: new ObjectId(id), userId: uid },
        { $set: { name } },
      );
    }

    // ✅ handle folder not found
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Folder not found" });
    }

    res.json({ message: "Folder name updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Directory
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const { uid: userId } = req.cookies;
  const uid = new ObjectId(userId);

  const foldersCollection = req.db.collection("folders");
  const filesCollection = req.db.collection("files");

  const dir = await foldersCollection.findOne({
    _id: new ObjectId(id),
    userId: uid,
  });
  if (!dir) {
    return res.status(404).json({ error: "Directory not found" });
  }
  if (!dir.userId.equals(uid)) {
    return res.status(403).json({ error: "Access Forbidden" });
  }
  try {
    await delDir(id, foldersCollection, filesCollection);
    return res.json({ message: "Folder Deleted Successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
});

// delete directory Recursive function
async function delDir(id, foldersCollection, filesCollection) {
  const folderId = new ObjectId(id);

  const currFolder = await foldersCollection.findOne({ _id: folderId });
  if (!currFolder) return;

  // 🔹 1. delete child folders recursively
  for (const childId of currFolder.folders) {
    await delDir(childId, foldersCollection, filesCollection);
  }

  // 🔹 2. delete all files in ONE query
  if (currFolder.files.length > 0) {
    // delete from filesystem
    for (const fileId of currFolder.files) {
      const file = await filesCollection.findOne({ _id: new ObjectId(fileId) });
      const fullPath = resolveSafePath(`${fileId.toString()}${file.extension}`);
      await fs.rm(fullPath, { force: true });
    }

    await filesCollection.deleteMany({
      _id: { $in: currFolder.files },
    });
  }

  // 🔹 3. remove from parent
  if (currFolder.parentDirId) {
    await foldersCollection.updateOne(
      { _id: new ObjectId(currFolder.parentDirId) },
      {
        $pull: { folders: folderId },
      },
    );
  }

  // 🔹 4. delete current folder
  await foldersCollection.deleteOne({ _id: folderId });
}
export default router;
