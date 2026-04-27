import mongoose from "mongoose";

export async function connectDB() {
  try {
    await mongoose.connect(
      "mongodb://Deepanshu:Deep%402004@localhost:27017/storageApp?replicaSet=myReplicaSet",
    );
    console.log("mongoose connected");
  } catch (error) {
    console.error("❌ DB Connection Error:", error);
    process.exit(1); // fail fast
  }
}

// graceful shutdown
process.on("SIGINT", async () => {
  await client.close();
  console.log("🔌 Client Disconnected");
  process.exit(0);
});
