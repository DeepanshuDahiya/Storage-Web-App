import express from "express";
import fs, { writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { baseDir } from "../app.js";
import filesData from "../filesDB.json" with { type: "json" };
import foldersData from "../folderDB.json" with { type: "json" };
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

// upload file
router.post("{/:parentDirId}", async (req, res) => {
  const { uid } = req.cookies;
  const user = req.user;
  try {
    let parentDirId = req.params.parentDirId || user.rootDir;
    const { filename } = req.headers;

    const id = crypto.randomUUID();
    const extension = path.extname(filename);
    const fullPath = resolveSafePath(`${id}${extension}`);

    const writeStream = createWriteStream(fullPath);

    req.pipe(writeStream);

    writeStream.on("finish", async () => {
      filesData.push({
        id,
        name: String(filename),
        extension,
        parentDirId,
        userId: uid,
      });
      const parentDir = foldersData.find((folder) => folder.id === parentDirId);
      parentDir.files.push(id);
      await writeFile("./filesDB.json", JSON.stringify(filesData, null, 2));
      await writeFile("./folderDB.json", JSON.stringify(foldersData, null, 2));
      return res.send("File uploaded successfully");
    });

    writeStream.on("error", () => {
      return res.status(500).send("Upload failed");
    });

    req.on("error", () => {
      return res.status(500).send("Request error");
    });
  } catch (err) {
    return res.status(403).send(err.message);
  }
});

// get files content
router.get("/:id", (req, res) => {
  try {
    let { id } = req.params;

    const { uid } = req.cookies;

    const file = filesData.find((file) => file.id === id);

    if (!file) {
      return res.status(404).json({ message: "File not found" });
    } else if (file.userId !== uid) {
      return res.status(403).json({ message: "Access Forbidden" });
    }

    const extension = file.extension;

    const fullPath = resolveSafePath(`${id}${extension}`);

    if (req.query.action === "download") {
      res.set("Content-Disposition", `attachment ; filename=${file.name}`);
    } else {
      res.set("Content-Disposition", "inline");
    }

    return res.sendFile(fullPath, (err) => {
      if (err) {
        if (!res.headersSent) {
          return res.status(404).json({ message: "File not found" });
        }
      }
    });
  } catch (err) {
    res.status(403).send(err.message);
  }
});

// rename file
router.patch("/:id", async (req, res) => {
  try {
    let { id } = req.params;
    let newFilename = req.body.newFilename || "Untitled";

    const { uid } = req.cookies;

    const file = filesData.find((f) => f.id === id);

    if (!file) {
      return res.status(404).send("File not found");
    } else if (uid !== file.userId) {
      return res.status(403).json({ message: "Access Forbidden" });
    }

    file.name = String(newFilename);

    await writeFile("./filesDB.json", JSON.stringify(filesData, null, 2));

    return res.send("Name Updated");
  } catch (err) {
    res.status(403).send(err.message);
  }
});

// delete file
router.delete("/:id", async (req, res) => {
  try {
    let { id } = req.params;

    const { uid } = req.cookies;

    const file = filesData.find((file) => file.id === id);

    if (!file) {
      return res.status(404).send("File not found");
    } else if (uid !== file.userId) {
      return res.status(403).json({ message: "Access Forbidden" });
    }

    const extension = file.extension;

    const fullPath = resolveSafePath(`${id}${extension}`);

    await fs.rm(fullPath, { recursive: true });

    const remFiles = filesData.filter((file) => file.id !== id);
    const parentDirData = foldersData.find(
      (folder) => folder.id === file.parentDirId,
    );
    parentDirData.files = parentDirData.files.filter(
      (fileId) => fileId !== file.id,
    );
    await writeFile("./filesDB.json", JSON.stringify(remFiles, null, 2));
    await writeFile("./folderDB.json", JSON.stringify(foldersData, null, 2));
    res.send("Deleted");
  } catch (err) {
    res.status(403).send(err.message);
  }
});

export default router;
