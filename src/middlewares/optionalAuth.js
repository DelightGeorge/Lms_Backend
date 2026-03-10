const jwt = require("jsonwebtoken");
const prisma = require("../prisma");

module.exports = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) { req.user = null; return next(); }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await prisma.user.findUnique({ where: { id: decoded.id } });
  } catch { req.user = null; }
  next();
};