import { connectDB } from "./db.js";
import mongoose from "mongoose";

const db = await connectDB();

const dbCommand = "collMod";

try {
  await db.command({
    [dbCommand]: "users",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["_id", "email", "name", "password", "rootDir"],
        properties: {
          _id: {
            bsonType: "objectId",
          },
          email: {
            bsonType: "string",
            pattern: "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+.[A-Za-z]{2,}$",
          },
          name: {
            bsonType: "string",
          },
          password: {
            bsonType: "string",
          },
          rootDir: {
            bsonType: "objectId",
          },
        },
        additionalProperties: false,
      },
    },
    validationAction: "error",
    validationLevel: "strict",
  });

  await db.command({
    [dbCommand]: "files",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["_id", "name", "extension", "parentDirId", "userId"],
        properties: {
          _id: {
            bsonType: "objectId",
          },
          name: {
            bsonType: "string",
          },
          extension: {
            bsonType: "string",
          },
          parentDirId: {
            bsonType: "objectId",
          },
          userId: {
            bsonType: "objectId",
          },
        },
        additionalProperties: false,
      },
    },
    validationAction: "error",
    validationLevel: "strict",
  });

  await db.command({
    [dbCommand]: "folders",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["_id", "files", "folders", "name", "parentDirId", "userId"],
        properties: {
          _id: {
            bsonType: "objectId",
          },
          files: {
            bsonType: "array",
          },
          folders: {
            bsonType: "array",
          },
          name: {
            bsonType: "string",
          },
          parentDirId: {
            bsonType: ["null", "objectId"],
          },
          userId: {
            bsonType: "objectId",
          },
        },
        additionalProperties: false,
      },
    },
    validationAction: "error",
    validationLevel: "strict",
  });
} catch (error) {
  console.log(error.message);
} finally {
  await mongoose.close();
}
