import { model, Schema } from "mongoose";

const fileModel = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    extension: {
      type: String,
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "users",
    },
    parentDirId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "folders",
    },
  },
  {
    versionKey: false,
  },
);

const files = model("files", fileModel);

export default files;
