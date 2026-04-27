import { ObjectId } from "mongodb";
import files from "../Models/fileModel.js";
import folders from "../Models/directoryModel.js";
import path from "path";
import { baseDir } from "../app.js";
import { createWriteStream } from "fs";
import fs, { writeFile } from "node:fs/promises";

// path traversal denied logic
function resolveSafePath(userPath = "") {
  const decoded = decodeURIComponent(userPath || "");
  const fullPath = path.resolve(baseDir, decoded);

  if (!fullPath.startsWith(baseDir)) {
    throw new Error("Access denied");
  }

  return fullPath;
}

export const uploadFile = async (req, res) => {
  const user = req.user;

  try {
    let parentDirId = req.params.parentDirId
      ? new ObjectId(req.params.parentDirId)
      : user.rootDir;

    const { filename } = req.headers;

    const extension = path.extname(filename);

    const fileResult = await files.insertOne({
      name: String(filename),
      extension,
      parentDirId,
      userId: user._id,
    });
    const fileId = fileResult._id;

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
    console.error("UPLOAD ERROR:", err); // 👈 log actual error
    return res.status(500).json({ error: err.message || err });
  }
};

export const getFile = async (req, res) => {
  try {
    let { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid file id" });
    }

    const user = req.user;

    const file = await files.findOne({ _id: new ObjectId(id) });

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    } else if (!file.userId.equals(user._id)) {
      return res.status(403).json({ error: "Access Forbidden" });
    }

    const extension = file.extension;

    const fullPath = resolveSafePath(`${id}${extension}`);

    if (req.query.action === "download") {
      res.set("Content-Disposition", `attachment ; filename=${file.name}`);
    } else {
      res.set("Content-Disposition", `inline ; filename=${file.name}`);
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
};

export const renameFile = async (req, res) => {

  const user = req.user;

  let { id } = req.params;
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid file id" });
  }

  let newFilename = req.body.newFilename || "Untitled";

  const file = await files.findOne({ _id: new ObjectId(id) });

  if (!file) {
    return res.status(404).send("File not found");
  } else if (!file.userId.equals(user._id)) {
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
};

export const deleteFile = async (req, res) => {
  try {
    let { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid file id" });
    }
    
    const user = req.user

    const file = await files.findOne({ _id: new ObjectId(id) });

    if (!file) {
      return res.status(404).send("File not found");
    } else if (!file.userId.equals(user._id)) {
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
};
