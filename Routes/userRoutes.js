import express from "express";
import fs from "node:fs/promises";
import { ObjectId } from "mongodb";
import {
  loginUser,
  logoutUser,
  registerUser,
  isLogin,
} from "../Controllers/userController.js";
import checkAuth from "../Middlewares/auth.js";

const router = express.Router();

router.post("/register", registerUser);

router.post("/login", loginUser);

router.post("/logout", logoutUser);

router.get("/me", checkAuth, isLogin);

export default router;
