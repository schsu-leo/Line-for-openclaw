const jwt = require('jsonwebtoken');
const db = require('../config/db');

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * Middleware: restrict endpoint to admin role.
 * Fetches current role from DB so role changes take effect immediately.
 */
const requireAdmin = async (req, res, next) => {
  try {
    const user = await db('users').where({ id: req.user.id }).select('role').first();
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: '需要管理員權限' });
    }
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Middleware: restrict endpoint to users with a specific module permission.
 */
const requireModule = (moduleName) => async (req, res, next) => {
  try {
    const user = await db('users').where({ id: req.user.id }).select('role', 'modules').first();
    if (!user) return res.status(403).json({ error: '權限不足' });
    if (user.role === 'admin') return next(); // admin has access to all modules
    if (user.modules && user.modules.includes(moduleName)) return next();
    return res.status(403).json({ error: `無 ${moduleName} 模組權限` });
  } catch (err) {
    next(err);
  }
};

module.exports = authMiddleware;
module.exports.requireAdmin = requireAdmin;
module.exports.requireModule = requireModule;
