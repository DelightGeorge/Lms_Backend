// src/middlewares/authmiddleware.js
const authMiddleware = (roles = []) => {
  return (req, res, next) => {
    // Example: req.user is set after login
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    next();
  };
};

module.exports = authMiddleware;
