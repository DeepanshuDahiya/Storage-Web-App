import express from "express";
import dirRoutes from "./Routes/dirRoutes.js";
import userRoutes from "./Routes/userRoutes.js";
import fileRoutes from "./Routes/fileRoutes.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import cors from "cors";
import checkAuth from "./Middlewares/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const baseDir = path.resolve(__dirname, "storage");

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

app.use("/directory", checkAuth, dirRoutes);
app.use("/file", checkAuth, fileRoutes);
app.use("/users", userRoutes);

app.use((err, req, res, next) => {
  res.status(500).json({ message: "Something went wrong !!" });
});

app.listen(4000, () => {
  console.log("listening on port 4000");
});
