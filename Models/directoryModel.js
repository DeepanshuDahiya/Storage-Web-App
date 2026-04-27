import { model, Schema } from "mongoose";

const folderSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    parentDirId: {
      type: Schema.Types.ObjectId,
      default: null,
      ref: "folders",
    },
    files: [{ type: Schema.Types.ObjectId, ref: "files" }],
    folders: [{ type: Schema.Types.ObjectId, ref: "folders" }],
  },
  {
    strict: "throw",
    versionKey: false,
  },
);

const folders = model("folders", folderSchema);
export default folders;
