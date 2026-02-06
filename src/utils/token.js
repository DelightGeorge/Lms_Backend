const jwt = require("jsonwebtoken");

exports.generateToken = (payload, expiresIn = "15m") => {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};
