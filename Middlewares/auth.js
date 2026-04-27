import { ObjectId } from "mongodb";
import mongoose from "mongoose";
import crypto from "node:crypto";
import users from "../Models/userModel.js";

export default async function checkAuth(req, res, next) {
  const { uid } = req.cookies;
  if (!uid) {
    return res.status(401).json({ error: "User not logged in" });
  }

  const userId = uid.slice(0, 24).trim();
  const hash = uid.slice(24);

  if (
    crypto
      .createHash("sha256")
      .update(userId)
      .update("secret-hashing-key")
      .digest("base64url") !== hash
  ) {
    res.clearCookie("uid", {
      httpOnly: true,
    });
    return res.status(500).json({ error: "User not logged in" });
  }

  try {
    const user = await users.findOne({
      _id: new ObjectId(`${userId}`),
    });
    console.log(`${userId}`);
    if (!user) {
      return res.status(401).json({ error: "user not found" });
    }
    req.user = user;
    req.userId = user._id;
    next();
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}
