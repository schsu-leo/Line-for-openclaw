// LINE智能客服/server/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const db = require('../config/db');

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // P1-2: 驗證帳號仍存在且啟用中
    const emp = await db('employees').where({ id: decoded.id }).select('is_active').first();
    if (!emp) return res.status(401).json({ error: '帳號不存在' });
    if (!emp.is_active) return res.status(403).json({ error: '帳號已停用' });
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// T2: 改用 JWT payload 判斷，不再查 DB
function requireAdmin(req, res, next) {
  if (!req.user?.roles?.includes('admin')) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// T2: 改用 JWT payload 判斷，不再查 DB
function requireModule(moduleName) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const isAdmin = req.user.roles?.includes('admin');
    const hasModule = req.user.modules?.includes(moduleName);
    if (!isAdmin && !hasModule) {
      return res.status(403).json({ error: `Module '${moduleName}' access required` });
    }
    next();
  };
}

// Default export is `authenticate` for backward compatibility with existing routes
// that do: const auth = require('../middleware/auth')
const middleware = authenticate;
middleware.authenticate = authenticate;
middleware.requireAdmin = requireAdmin;
middleware.requireModule = requireModule;

module.exports = middleware;
