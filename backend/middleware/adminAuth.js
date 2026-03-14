const jwt = require('jsonwebtoken');

// Separate from regular auth middleware.
// Verifies that the token was issued by admin login
// AND that the user has role === 'admin'.

module.exports = function adminAuth(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No admin token.' });
  }

  const token = header.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access only.' });
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Admin token invalid or expired.' });
  }
};