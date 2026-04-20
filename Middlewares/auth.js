import userData from "../userDB.json" with { type: "json" };

export default function checkAuth(req, res, next) {
  const { uid } = req.cookies;
  if (!uid) {
    res.status(401).json({ cookie: `${uid}` });
  }
  const user = userData.find((user) => user.id === uid);

  if (!user) {
    res.status(401).json({ message: "user not found" });
  }
  req.user = user;
  next();
}
