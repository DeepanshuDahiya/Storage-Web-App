import { model, Schema } from "mongoose";

const UserModel = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[\w.-]+@[a-zA-Z\d.-]+\.[a-zA-Z]{2,}$/, "Invalid email format"],
    },
    password: {
      type: String,
      required: true,
    },
    rootDir: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "folders",
    },
  },
  {
    versionKey: false,
    strict: "throw",
  },
);

const users = model("users", UserModel);

export default users;
