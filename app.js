import express from "express";
import dirRoutes from "./Routes/dirRoutes.js";
import userRoutes from "./Routes/userRoutes.js";
import fileRoutes from "./Routes/fileRoutes.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import cors from "cors";
import checkAuth from "./Middlewares/auth.js";
import { connectDB } from "./config/db.js";
import dotenv from "dotenv";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const baseDir = path.resolve(__dirname, "storage");

try {
  const db = await connectDB();
  const app = express();

  app.use((req, res, next) => {
    req.db = db;
    next();
  });
  app.use(
    cors({
      origin: [
        "http://localhost:5173",
        "storage-web-app-frontend-i7p60x96l-ss-projects-27de03c3.vercel.app",
        "storage-web-app-frontend.vercel.app",
      ],
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(cookieParser());

  app.use("/directory", checkAuth, dirRoutes);
  app.use("/file", checkAuth, fileRoutes);
  app.use("/users", userRoutes);

  app.use((err, req, res, next) => {
    console.log(err);
    return res.status(500).json({ error: err.message });
  });

  app.listen(process.env.PORT || 4000, () => {
    console.log(`listening on port ${process.env.PORT || 4000}`);
  });
} catch (error) {
  console.log("Error in DB connection");
  console.log(error);
}
