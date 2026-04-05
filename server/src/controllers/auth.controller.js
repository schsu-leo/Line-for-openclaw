const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const logger = require('../config/logger');

async function register(req, res, next) {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const existing = await db('users').where({ email }).first();
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const [user] = await db('users').insert({ email, password_hash, name }).returning(['id', 'email', 'name', 'role', 'employee_no', 'modules', 'created_at']);

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role, employeeNo: user.employee_no || null, modules: user.modules || [] }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ user, token });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await db('users').where({ email }).first();
    if (!user) {
      logger.warn(`Login failed (unknown email): ip=${req.ip}, email=${email}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      logger.warn(`Login failed (wrong password): ip=${req.ip}, email=${email}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role, employeeNo: user.employee_no || null, modules: user.modules || [] }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role || 'admin',
        employeeNo: user.employee_no || null,
        modules: user.modules || [],
        requiresPasswordChange: !!user.requires_password_change,
      },
      token,
    });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const user = await db('users').where({ id: req.user.id }).select('id', 'email', 'name', 'role', 'employee_no', 'modules', 'requires_password_change', 'created_at').first();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role || 'admin',
      employeeNo: user.employee_no || null,
      modules: user.modules || [],
      requiresPasswordChange: !!user.requires_password_change,
      created_at: user.created_at,
    });
  } catch (err) {
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: '請輸入目前密碼和新密碼' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: '新密碼至少需要 8 個字元' });
    }

    const user = await db('users').where({ id: req.user.id }).first();
    if (!user) {
      return res.status(404).json({ error: '找不到使用者' });
    }

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: '目前密碼不正確' });
    }

    const password_hash = await bcrypt.hash(newPassword, 10);
    await db('users').where({ id: req.user.id }).update({
      password_hash,
      requires_password_change: false,
      updated_at: new Date(),
    });

    res.json({ success: true, message: '密碼已更新' });
  } catch (err) {
    next(err);
  }
}

async function listAdmins(req, res, next) {
  try {
    const users = await db('users').select('id', 'email', 'name', 'role', 'employee_no', 'modules', 'is_active', 'created_at').orderBy('created_at', 'asc');
    res.json(users);
  } catch (err) {
    next(err);
  }
}

const VALID_ROLES = ['admin', 'manager', 'staff'];

async function createAdmin(req, res, next) {
  try {
    const { email, password, name, role = 'staff', employee_no, modules } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email 和密碼為必填' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: '密碼至少需要 8 個字元' });
    }
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: '無效的角色' });
    }
    const existing = await db('users').where({ email }).first();
    if (existing) {
      return res.status(409).json({ error: '此 Email 已被使用' });
    }
    const password_hash = await bcrypt.hash(password, 10);
    const insertData = { email, password_hash, name, role, requires_password_change: true };
    if (employee_no) insertData.employee_no = employee_no;
    if (modules) insertData.modules = modules;
    const [user] = await db('users')
      .insert(insertData)
      .returning(['id', 'email', 'name', 'role', 'employee_no', 'modules', 'created_at']);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
}

async function deleteAdmin(req, res, next) {
  try {
    const { id } = req.params;
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: '不能刪除自己的帳號' });
    }
    const deleted = await db('users').where({ id }).del();
    if (!deleted) return res.status(404).json({ error: '找不到此帳號' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function resetAdminPassword(req, res, next) {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: '新密碼至少需要 8 個字元' });
    }
    const user = await db('users').where({ id }).first();
    if (!user) return res.status(404).json({ error: '找不到此帳號' });
    const password_hash = await bcrypt.hash(newPassword, 10);
    await db('users').where({ id }).update({ password_hash, requires_password_change: true, updated_at: new Date() });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function updateAdminRole(req, res, next) {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: '無效的角色' });
    }
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: '不能修改自己的角色' });
    }
    const updated = await db('users').where({ id }).update({ role, updated_at: new Date() });
    if (!updated) return res.status(404).json({ error: '找不到此帳號' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, me, changePassword, listAdmins, createAdmin, deleteAdmin, resetAdminPassword, updateAdminRole };
