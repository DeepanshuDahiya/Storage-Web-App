import express from "express";
import usersJson from "../userDB.json" with { type: "json" };
import foldersJson from "../folderDB.json" with { type: "json" };
import fs from "node:fs/promises";

let usersData = [...usersJson];
let foldersData = [...foldersJson];

const router = express.Router();

router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(500).json({ message: "All input fields are required" });
  const existingUser = usersData.findIndex((user) => user.email === email);
  if (existingUser !== -1)
    return res.status(400).json({
      message: "User with this Email already exists",
    });

  const userId = crypto.randomUUID();

  const dirId = crypto.randomUUID();

  try {
    foldersData.push({
      id: dirId,
      name: `root-${email}`,
      parentDirId: null,
      userId,
      files: [],
      folders: [],
    });

    usersData.push({
      id: userId,
      name,
      email,
      password,
      rootDir: dirId,
    });
    await fs.writeFile("./userDB.json", JSON.stringify(usersData, null, 2));
    await fs.writeFile("./folderDB.json", JSON.stringify(foldersData, null, 2));
    return res.status(200).json({
      message: "User created",
      user: {
        id: userId,
        name,
        email,
      },
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(500).json({ message: "All input fields are required" });
  }
  const existingUser = usersData.find((user) => user.email === email);
  if (!existingUser || existingUser.password !== password) {
    return res.status(400).json({ message: "Invalid Credentials" });
  }
  res.cookie("uid", existingUser.id, {
    httpOnly: true,
  });
  return res.json({ user: existingUser });
});

router.post("/logout", (req, res) => {
  res.clearCookie("uid", {
    httpOnly: true,
  });

  res.json({ message: "Logged out" });
});

export default router;
