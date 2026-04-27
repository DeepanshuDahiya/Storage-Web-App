import express from "express";
import fs, { writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { baseDir } from "../app.js";
import idValidation from "../Middlewares/idValidationMiddleware.js";
import { ObjectId } from "mongodb";
import {
  deleteFile,
  getFile,
  renameFile,
  uploadFile,
} from "../Controllers/fileController.js";

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

router.post("{/:parentDirId}", uploadFile);
router.get("/:id", getFile);
router.patch("/:id", renameFile);
router.delete("/:id", deleteFile);

export default router;
