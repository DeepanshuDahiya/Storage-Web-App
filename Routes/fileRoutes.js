import express from "express";
import fs, { writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
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

// upload file
router.post("{/:parentDirId}", async (req, res) => {
  const { uid: userId } = req.cookies;
  const uid = new ObjectId(userId);
  const user = req.user;

  try {
    let parentDirId = req.params.parentDirId
      ? new ObjectId(req.params.parentDirId)
      : user.rootDir;

    const { filename } = req.headers;

    const files = req.db.collection("files");
    const folders = req.db.collection("folders");

    const extension = path.extname(filename);

    const fileResult = await files.insertOne({
      name: String(filename),
      extension,
      parentDirId,
      userId: uid,
    });
    const fileId = fileResult.insertedId;

    const fullPath = resolveSafePath(`${fileId}${extension}`);
    const writeStream = createWriteStream(fullPath);
    req.pipe(writeStream);

    writeStream.on("finish", async () => {
      const parentFolder = await folders.updateOne(
        { _id: new ObjectId(parentDirId) },
        {
          $push: {
            files: fileId,
          },
        },
      );
      return res.json({ message: "File Uploaded successfully" });
    });

    writeStream.on("error", async () => {
      // ❗ 1. delete file (if partially created)
      fs.unlink(filePath, () => {});

      // ❗ 2. delete DB entry
      await files.deleteOne({ _id: fileId });
      return res.status(500).json({ error: "Upload failed" });
    });

    req.on("error", () => {
      return res.status(500).json({ error: "Request error" });
    });
  } catch (err) {
    return res.status(403).json({ error: err.message });
  }
});

// get files content
router.get("/:id", async (req, res) => {
  try {
    let { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid file id" });
    }
    const { uid: userId } = req.cookies;
    const uid = new ObjectId(userId);

    const files = req.db.collection("files");
    const file = await files.findOne({ _id: new ObjectId(id) });

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    } else if (!file.userId.equals(uid)) {
      return res.status(403).json({ error: "Access Forbidden" });
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
          return res.status(404).json({ error: "File not found" });
        }
      }
    });
  } catch (err) {
    res.status(403).json({ error: err.message });
  }
});

// rename file
router.patch("/:id", async (req, res) => {
  let { id } = req.params;
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid file id" });
  }
  let newFilename = req.body.newFilename || "Untitled";

  const { uid: userId } = req.cookies;
  const uid = new ObjectId(userId);

  const files = req.db.collection("files");
  const file = await files.findOne({ _id: new ObjectId(id) });

  if (!file) {
    return res.status(404).send("File not found");
  } else if (!file.userId.equals(uid)) {
    return res.status(403).json({ error: "Access Forbidden" });
  }

  try {
    const result = await files.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          name: `${newFilename}${file.extension}`,
        },
      },
    );
    if (result.modifiedCount === 0) {
      return res.status(400).json({ message: "No changes made" });
    }
    return res.json({ message: "Name Updated" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// delete file
router.delete("/:id", async (req, res) => {
  try {
    let { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid file id" });
    }
    const { uid: userId } = req.cookies;
    const uid = new ObjectId(userId);

    const folders = req.db.collection("folders");
    const files = req.db.collection("files");
    const file = await files.findOne({ _id: new ObjectId(id) });

    if (!file) {
      return res.status(404).send("File not found");
    } else if (!file.userId.equals(uid)) {
      return res.status(403).json({ error: "Access Forbidden" });
    }

    const extension = file.extension;
    const fullPath = resolveSafePath(`${id}${extension}`);
    const parentDirId = file.parentDirId;

    await fs.rm(fullPath, { force: true });

    const fileResult = await files.deleteOne({ _id: new ObjectId(id) });
    const folderResult = await folders.updateOne(
      { _id: new ObjectId(parentDirId) },
      {
        $pull: {
          files: new ObjectId(id),
        },
      },
    );

    return res.json({ message: "File Deleted" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
