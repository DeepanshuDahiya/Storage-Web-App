import { ObjectId } from "mongodb";

export default async function checkAuth(req, res, next) {
  const { uid } = req.cookies;
  if (!uid) {
    return res.status(401).json({ error: "User not logged in" });
  }

  try {
    const users = req.db.collection("users");
    const user = await users.findOne({ _id: new ObjectId(uid) });

    if (!user) {
      return res.status(401).json({ error: "user not found" });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}
