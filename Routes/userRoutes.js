import express from "express";
import fs from "node:fs/promises";
import { ObjectId } from "mongodb";
import { client } from "../config/db.js";

const router = express.Router();

router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(500).json({ message: "All input fields are required" });

  const users = req.db.collection("users");
  const folders = req.db.collection("folders");

  const existingUser = await users.findOne({ email: email });
  if (existingUser) {
    return res
      .status(400)
      .json({ error: "User with this Email already exists." });
  }
  const session = client.startSession();
  try {
    const rootDir = new ObjectId();
    const userId = new ObjectId();

    session.startTransaction();

    await folders.insertOne(
      {
        _id: rootDir,
        name: `User-${email}`,
        parentDirId: null,
        userId,
        files: [],
        folders: [],
      },
      { session },
    );

    await users.insertOne(
      {
        _id: userId,
        name,
        email,
        password,
        rootDir,
      },
      { session },
    );

    await session.commitTransaction();

    return res.status(201).json({
      message: "User registered successfully",
      userId,
      rootDir,
    });
  } catch (error) {
    session.abortTransaction();
    return res.status(400).json({ error: error.message });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(500).json({ error: "All input fields are required" });

  const users = req.db.collection("users");
  const folders = req.db.collection("folders");

  try {
    const existingUser = await users.findOne({ email: email });
    if (!existingUser || existingUser.password !== password) {
      return res.status(400).json({ error: "Invalid Credentials" });
    }
    res.cookie("uid", existingUser._id.toString(), {
      httpOnly: true,
    });
    return res.json({ user: existingUser });
  } catch (error) {
    return res.json({ error: error.message });
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie("uid", {
    httpOnly: true,
  });

  res.json({ message: "Logged out" });
});

export default router;
