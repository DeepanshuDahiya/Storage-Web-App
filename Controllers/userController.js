import { ObjectId } from "mongodb";
import crypto from "node:crypto";
import mongoose from "mongoose";
import users from "../Models/userModel.js";
import folders from "../Models/directoryModel.js";

export const registerUser = async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(500).json({ message: "All input fields are required" });

  const session = await mongoose.startSession();
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
    await session.abortTransaction();
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ error: "User with ths Email Already Exists" });
    }
    return res
      .status(400)
      .json({ error: error.message, errorCode: error.code });
  }
};

export const loginUser = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(500).json({ error: "All input fields are required" });

  try {
    const existingUser = await users.findOne({ email: email });
    if (!existingUser || existingUser.password !== password) {
      return res.status(400).json({ error: "Invalid Credentials" });
    }
    // Hashing the cookie
    const idHash = crypto
      .createHash("sha256")
      .update(existingUser._id.toString())
      .update("secret-hashing-key")
      .digest("base64url");

    const signedCookie = existingUser._id.toString() + idHash;

    res.cookie("uid", signedCookie, {
      httpOnly: true,
    });
    return res.json({ user: existingUser });
  } catch (error) {
    return res.json({ error: error.message });
  }
};

export const logoutUser = (req, res) => {
  res.clearCookie("uid", {
    httpOnly: true,
  });

  res.json({ message: "Logged out" });
};

export const isLogin = async (req, res) => {
  try {
    console.log(req.userId);
    const user = await users.findById(req.userId).select("-password");

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    res.json({ user });
  } catch (error) {
    return res.json({ error: error.message });
  }
};
