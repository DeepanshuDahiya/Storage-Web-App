import express from "express";
import fs, { writeFile } from "node:fs/promises";
import path from "node:path";
import { baseDir } from "../app.js";
import idValidation from "../Middlewares/idValidationMiddleware.js";
import { ObjectId } from "mongodb";
import {
  createDir,
  deleteDir,
  getDir,
  renameDir,
} from "../Controllers/dirController.js";

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
router.get("{/:id}", getDir);

// make dir
router.post("{/:parentDirId}", createDir);

// Rename Directory
router.patch("{/:id}", renameDir);

// Delete Directory
router.delete("/:id", deleteDir);

export default router;
