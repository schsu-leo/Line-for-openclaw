// LINE智能客服/server/src/controllers/auth.controller.js
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const logger = require('../config/logger');

// T4: Refresh Token 工具函式
function generateRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

async function saveRefreshToken(employeeId, rawToken) {
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 天
  await db('refresh_tokens').insert({ employee_id: employeeId, token_hash: hash, expires_at: expiresAt });
  return rawToken;
}

// 從 employees 記錄產生 JWT
function signEmployeeToken(emp) {
  return jwt.sign(
    {
      id: emp.id,           // UUID string
      email: emp.email,
      name: emp.name,
      roles: emp.roles || [],
      employeeNo: emp.employee_no || null,
      modules: emp.modules || [],
    },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );
}

// 從 employees 欄位組裝前端回傳格式
function formatEmployee(emp, deptName) {
  return {
    id: emp.id,
    email: emp.email,
    name: emp.name,
    roles: emp.roles || [],
    employeeNo: emp.employee_no || null,
    modules: emp.modules || [],
    department: deptName || null,
    requiresPasswordChange: !!emp.requires_password_change,
    isActive: emp.is_active,
    createdAt: emp.created_at,
  };
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const emp = await db('employees').where({ email }).first();
    if (!emp) {
      logger.warn(`Login failed (unknown email): ip=${req.ip}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    // P1-2: 停用帳號不可登入
    if (!emp.is_active) {
      logger.warn(`Login failed (inactive account): email=${email} ip=${req.ip}`);
      return res.status(403).json({ error: '帳號已停用，請聯繫管理員' });
    }
    const valid = await bcrypt.compare(password, emp.password_hash);
    if (!valid) {
      logger.warn(`Login failed (wrong password): ip=${req.ip}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const dept = emp.department_id
      ? await db('departments').where({ id: emp.department_id }).select('name').first()
      : null;

    const token = signEmployeeToken(emp);
    // T4: 建立 refresh token 並存入 HttpOnly cookie
    const refreshToken = await saveRefreshToken(emp.id, generateRefreshToken());
    res
      .cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/api/auth/refresh',
      })
      .json({ user: formatEmployee(emp, dept?.name), token });
  } catch (err) { next(err); }
}

async function me(req, res, next) {
  try {
    const emp = await db('employees').where({ id: req.user.id }).first();
    if (!emp) return res.status(404).json({ error: 'User not found' });
    const dept = emp.department_id
      ? await db('departments').where({ id: emp.department_id }).select('name').first()
      : null;
    res.json(formatEmployee(emp, dept?.name));
  } catch (err) { next(err); }
}

async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: '請輸入目前密碼和新密碼' });
    if (newPassword.length < 8) return res.status(400).json({ error: '新密碼至少需要 8 個字元' });

    const emp = await db('employees').where({ id: req.user.id }).first();
    if (!emp) return res.status(404).json({ error: '找不到使用者' });

    const valid = await bcrypt.compare(currentPassword, emp.password_hash);
    if (!valid) return res.status(401).json({ error: '目前密碼不正確' });

    const password_hash = await bcrypt.hash(newPassword, 10);
    await db('employees').where({ id: req.user.id }).update({
      password_hash,
      requires_password_change: false,
      updated_at: new Date(),
    });
    res.json({ success: true, message: '密碼已更新' });
  } catch (err) { next(err); }
}

async function listAdmins(req, res, next) {
  try {
    const emps = await db('employees')
      .leftJoin('departments', 'employees.department_id', 'departments.id')
      .select(
        'employees.id', 'employees.email', 'employees.name', 'employees.roles',
        'employees.employee_no', 'employees.modules', 'employees.is_active',
        'employees.created_at', 'employees.requires_password_change',
        db.raw("departments.name as department")
      )
      .orderBy('employees.created_at', 'asc');
    res.json(emps.map(emp => formatEmployee(emp, emp.department)));
  } catch (err) { next(err); }
}

const VALID_ROLES = ['admin', 'manager', 'staff'];

async function createAdmin(req, res, next) {
  try {
    const { email, password, name, role = 'staff', modules } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email 和密碼為必填' });
    if (password.length < 8) return res.status(400).json({ error: '密碼至少需要 8 個字元' });
    if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: '無效的角色' });

    const existing = await db('employees').where({ email }).first();
    if (existing) return res.status(409).json({ error: '此 Email 已被使用' });

    const password_hash = await bcrypt.hash(password, 10);
    const id = require('crypto').randomUUID();

    await db('employees').insert({
      id,
      email,
      password_hash,
      name,
      roles: [role],
      modules: modules || [],
      requires_password_change: true,
      is_active: true,
      employment_type: 'full_time',
      onboard_status: 'approved',
      created_at: new Date(),
      updated_at: new Date(),
    });

    const emp = await db('employees').where({ id }).first();
    res.status(201).json(formatEmployee(emp, null));
  } catch (err) { next(err); }
}

async function deleteAdmin(req, res, next) {
  try {
    const { id } = req.params;
    if (id === req.user.id) return res.status(400).json({ error: '不能刪除自己的帳號' });
    const deleted = await db('employees').where({ id }).del();
    if (!deleted) return res.status(404).json({ error: '找不到此帳號' });
    res.json({ success: true });
  } catch (err) { next(err); }
}

async function resetAdminPassword(req, res, next) {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: '新密碼至少需要 8 個字元' });
    const emp = await db('employees').where({ id }).first();
    if (!emp) return res.status(404).json({ error: '找不到此帳號' });
    const password_hash = await bcrypt.hash(newPassword, 10);
    await db('employees').where({ id }).update({ password_hash, requires_password_change: true, updated_at: new Date() });
    res.json({ success: true });
  } catch (err) { next(err); }
}

async function updateAdminRole(req, res, next) {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: '無效的角色' });
    if (id === req.user.id) return res.status(400).json({ error: '不能修改自己的角色' });
    const updated = await db('employees').where({ id }).update({
      roles: [role],
      updated_at: new Date(),
    });
    if (!updated) return res.status(404).json({ error: '找不到此帳號' });
    res.json({ success: true });
  } catch (err) { next(err); }
}

async function updateAdminModules(req, res, next) {
  try {
    const { id } = req.params;
    const { modules } = req.body;
    if (!Array.isArray(modules)) return res.status(400).json({ error: 'modules 必須是陣列' });
    const updated = await db('employees').where({ id }).update({
      modules,
      updated_at: new Date(),
    });
    if (!updated) return res.status(404).json({ error: '找不到此帳號' });
    res.json({ success: true });
  } catch (err) { next(err); }
}

// T4: Refresh Token — 用 HttpOnly cookie 中的 refresh token 換發新 access token
async function refreshToken(req, res, next) {
  try {
    const rawToken = req.cookies?.refresh_token;
    if (!rawToken) return res.status(401).json({ error: 'No refresh token' });
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const record = await db('refresh_tokens')
      .where({ token_hash: hash, revoked: false })
      .where('expires_at', '>', new Date())
      .first();
    if (!record) return res.status(401).json({ error: 'Invalid or expired refresh token' });
    const emp = await db('employees').where({ id: record.employee_id }).first();
    if (!emp) return res.status(401).json({ error: 'User not found' });
    if (!emp.is_active) return res.status(403).json({ error: '帳號已停用' });
    const token = signEmployeeToken(emp);
    res.json({ token });
  } catch (err) { next(err); }
}

// T4: Logout — 撤銷 refresh token
async function logout(req, res, next) {
  try {
    const rawToken = req.cookies?.refresh_token;
    if (rawToken) {
      const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
      await db('refresh_tokens').where({ token_hash: hash }).update({ revoked: true });
    }
    res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
    res.json({ success: true });
  } catch (err) { next(err); }
}

async function getDepartments(req, res, next) {
  try {
    const rows = await db('departments')
      .select('name')
      .orderBy('name');
    res.json(rows.map(r => r.name));
  } catch (err) { next(err); }
}

module.exports = { login, me, changePassword, listAdmins, createAdmin, deleteAdmin, resetAdminPassword, updateAdminRole, updateAdminModules, refreshToken, logout, getDepartments };
