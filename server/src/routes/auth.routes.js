const express = require('express');
const router = express.Router();
const { login, me, changePassword, listAdmins, createAdmin, deleteAdmin, resetAdminPassword, updateAdminRole, updateAdminModules, refreshToken, logout } = require('../controllers/auth.controller');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.post('/login', login);
router.post('/refresh', refreshToken);   // T4: 不需 authenticate（用 cookie 驗證）
router.post('/logout', logout);           // T4: 不需 authenticate（撤銷 cookie）
router.get('/me', authenticate, me);
router.put('/password', authenticate, changePassword);
router.get('/admins', authenticate, requireAdmin, listAdmins);
router.post('/admins', authenticate, requireAdmin, createAdmin);
router.delete('/admins/:id', authenticate, requireAdmin, deleteAdmin);
router.put('/admins/:id/password', authenticate, requireAdmin, resetAdminPassword);
router.patch('/admins/:id/role', authenticate, requireAdmin, updateAdminRole);
router.patch('/admins/:id/modules', authenticate, requireAdmin, updateAdminModules);

module.exports = router;
