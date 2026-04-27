import { ObjectId } from "mongodb";
import folders from "../Models/directoryModel.js";
import files from "../Models/fileModel.js";
import fs, { writeFile } from "node:fs/promises";
import path from "node:path";
import { baseDir } from "../app.js";

// path traversal denied logic
function resolveSafePath(userPath = "") {
  const decoded = decodeURIComponent(userPath || "");
  const fullPath = path.resolve(baseDir, decoded);

  if (!fullPath.startsWith(baseDir)) {
    throw new Error("Access denied");
  }

  return fullPath;
}

export const getDir = async (req, res) => {
  const user = req.user;
  const id = req.params.id ? req.params.id : user.rootDir.toString();

  try {
    let folderData = await folders
      .findOne({ _id: new ObjectId(id) })
      .populate("files")
      .populate("folders")
      .lean();

    // ✅ handle folder not found
    if (!folderData) {
      return res.status(404).json({ error: "Folder not found" });
    } else if (!folderData.userId.equals(user._id)) {
      return res.status(403).json({ error: "Access Forbidden" });
    }

    return res.json(folderData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createDir = async (req, res) => {
  const { name: dirName } = req.body || "Untitled";

  const user = req.user;
  const parentDirId = req.params.parentDirId
    ? new ObjectId(req.params.parentDirId)
    : user.rootDir;

  try {
    const folderResult = await folders.insertOne({
      name: dirName,
      parentDirId,
      userId: user._id,
      files: [],
      folders: [],
    });

    const folderId = folderResult._id;

    const parentFolder = await folders.updateOne(
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
};

export const renameDir = async (req, res) => {
  const { id } = req.params;
  const name = req.body.name;
  const user = req.user;

  let result;

  try {
    if (!id) {
      result = await folders.updateOne(
        { _id: new ObjectId(user.rootDir), userId: user._id },
        { $set: { name: newName } },
      );
    } else {
      result = await folders.updateOne(
        { _id: new ObjectId(id), userId: user._id },
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
};

export const deleteDir = async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  const dir = await folders.findOne({
    _id: new ObjectId(id),
    userId: user._id,
  });
  if (!dir) {
    return res.status(404).json({ error: "Directory not found" });
  }
  if (!dir.userId.equals(user._id)) {
    return res.status(403).json({ error: "Access Forbidden" });
  }
  try {
    await delDir(id, folders, files);
    return res.json({ message: "Folder Deleted Successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
};

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
