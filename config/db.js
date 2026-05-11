import mongoose from "mongoose";

export async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("mongoose connected");
  } catch (error) {
    console.error("❌ DB Connection Error:", error);
    process.exit(1); // fail fast
  }
}

// graceful shutdown
process.on("SIGINT", async () => {
  await mongoose.disconnect();
  console.log("🔌 Client Disconnected");
  process.exit(0);
});
