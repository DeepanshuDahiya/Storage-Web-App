import { MongoClient } from "mongodb";

const uri =
  "mongodb://Deepanshu:Deep%402004@localhost:27017/storageApp?replicaSet=myReplicaSet";
export const client = new MongoClient(uri);

let db;

export async function connectDB() {
  try {
    if (!db) {
      await client.connect();
      db = client.db("storageApp"); // explicit DB name
      console.log("✅ Database Connected");
    }

    return db; // ALWAYS return
  } catch (err) {
    console.error("❌ DB Connection Error:", err);
    process.exit(1); // fail fast
  }
}

// graceful shutdown
process.on("SIGINT", async () => {
  await client.close();
  console.log("🔌 Client Disconnected");
  process.exit(0);
});
