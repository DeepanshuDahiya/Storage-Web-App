import express from "express";
import fs, { writeFile } from "node:fs/promises";
import path from "node:path";
import { baseDir } from "../app.js";
import foldersData from "../folderDB.json" with { type: "json" };
import filesData from "../filesDB.json" with { type: "json" };
import idValidation from "../Middlewares/idValidationMiddleware.js";

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
  const { uid } = req.cookies;
  const user = req.user;
  const id = req.params.id || user.rootDir;

  let folderData = foldersData.find((folder) => folder.id === id);

  if (folderData.userId !== uid) {
    return res.status(403).json({ message: "Access Forbidden" });
  }

  // ✅ handle folder not found
  if (!folderData) {
    return res.status(404).json({ message: "Folder not found" });
  }
  try {
    // ✅ map + remove undefined
    const files = folderData.files
      .map((fileId) => filesData.find((file) => file.id === fileId))
      .filter(Boolean); // removes undefined/null

    const folders = folderData.folders
      .map((folderId) => foldersData.find((folder) => folder.id === folderId))
      .filter(Boolean);

    return res.json({ ...folderData, files, folders });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// make dir
router.post("{/:parentDirId}", async (req, res) => {
  const { uid } = req.cookies;
  const { name: dirName } = req.body;
  const id = crypto.randomUUID();

  const user = req.user;
  const parentDirId = req.params.parentDirId || user.parentDirId;

  foldersData.push({
    id,
    name: dirName,
    parentDirId,
    userId: uid,
    files: [],
    folders: [],
  });
  const parentFolder = foldersData.find((parent) => parent.id === parentDirId);
  try {
    if (parentFolder) parentFolder.folders = [...parentFolder.folders, id];
    await writeFile("./folderDB.json", JSON.stringify(foldersData, null, 2));
    res.status(201).json({ message: "Folder created", id });
  } catch (err) {
    res.send(err.message);
  }
});

// Rename Directory
router.patch("{/:id}", async (req, res) => {
  const { id } = req.params;
  const { uid } = req.cookies;
  const name = String(req.body.name);

  let folderData;

  if (!id) {
    const user = req.user;
    folderData = foldersData.find((folder) => folder.id === user.parentDirId);
  } else {
    folderData = foldersData.find((folder) => folder.id === id);
  }

  // ✅ handle folder not found
  if (!folderData) {
    return res.status(404).json({ message: "Folder not found" });
  }
  try {
    // rename folder
    folderData.name = name;
    await writeFile("./folderDB.json", JSON.stringify(foldersData, null, 2));

    res.json({ foldersData });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Delete Directory
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const { uid } = req.cookies;

  const dir = foldersData.find((folder) => folder.id === id);
  if (!dir) {
    return res.status(404).json({ message: "Directory not found" });
  }
  if (dir.userId !== uid) {
    return res.status(403).json({ message: "Access Forbidden" });
  }
  try {
    await delDir(id);
    await writeFile("./filesDB.json", JSON.stringify(filesData, null, 2));
    await writeFile("./folderDB.json", JSON.stringify(foldersData, null, 2));

    return res.json({ message: "Directory deleted successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// delete directory Recursive function
async function delDir(id) {
  const currFolder = foldersData.find((folder) => folder.id === id);
  if (!currFolder) return;

  // 1. recurse first
  const childFolders = [...currFolder.folders];
  for (const child of childFolders) {
    await delDir(child);
  }

  // 2. THEN handle current folder
  try {
    const childFiles = [...currFolder.files];
    const files = childFiles.map((fileId) =>
      filesData.find((file) => file.id === fileId),
    );
    for (const file of files) {
      if (!file) continue;
      const extension = file?.extension;

      const fullPath = resolveSafePath(`${file.id}${extension}`);
      await fs.rm(fullPath, { force: true });
    }
    filesData = filesData.filter((f) => !childFiles.includes(f.id));

    // then update parent
    const parentDirId = currFolder.parentDirId;
    const parent = foldersData.find((f) => f.id === parentDirId);
    if (parent) {
      parent.folders = parent.folders.filter((fId) => fId !== id);
    }

    // delete folder itself
    foldersData = foldersData.filter((folder) => folder.id !== id);
  } catch (error) {
    console.log(error.message);
  }
}
export default router;
