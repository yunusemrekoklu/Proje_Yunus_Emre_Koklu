import express from 'express';
import { dbAll, dbGet, dbRun } from '../db/schema';
import { hashPassword } from '../services/auth';
import { requireAdmin } from '../middleware/auth';

const router = express.Router();

// Apply admin middleware to all routes
router.use(requireAdmin);

// GET /api/users - List all users
router.get('/', async (req, res) => {
  try {
    const users = await dbAll(`
      SELECT u.id, u.name, u.email, u.role, u.facultyId, u.departmentId, u.createdAt,
             f.name as facultyName,
             d.name as departmentName
      FROM users u
      LEFT JOIN faculties f ON u.facultyId = f.id
      LEFT JOIN departments d ON u.departmentId = d.id
      ORDER BY u.role, u.name
    `);

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users'
    });
  }
});

// GET /api/users/:id - Get single user
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const user = await dbGet(`
      SELECT u.id, u.name, u.email, u.role, u.facultyId, u.departmentId, u.createdAt,
             f.name as facultyName,
             d.name as departmentName
      FROM users u
      LEFT JOIN faculties f ON u.facultyId = f.id
      LEFT JOIN departments d ON u.departmentId = d.id
      WHERE u.id = ?
    `, [Number(id)]);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user'
    });
  }
});

// POST /api/users - Create new user
router.post('/', async (req, res) => {
  const { name, email, password, role, facultyId, departmentId } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({
      success: false,
      error: 'İsim, e-posta, şifre ve rol gereklidir'
    });
  }

  if (!['admin', 'instructor', 'student'].includes(role)) {
    return res.status(400).json({
      success: false,
      error: 'Rol admin, instructor veya student olmalıdır'
    });
  }

  try {
    // Check if email already exists
    const existing = await dbGet('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Bu e-posta zaten kullanımda'
      });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Insert user
    const result = await dbRun(
      'INSERT INTO users (name, email, password, role, facultyId, departmentId, createdAt) VALUES (?, ?, ?, ?, ?, ?, datetime("now"))',
      [name, email, hashedPassword, role, facultyId || null, departmentId || null]
    );

    const newUserId = result.lastInsertRowid;

    // Get created user
    const user = await dbGet(`
      SELECT u.id, u.name, u.email, u.role, u.facultyId, u.departmentId, u.createdAt,
             f.name as facultyName,
             d.name as departmentName
      FROM users u
      LEFT JOIN faculties f ON u.facultyId = f.id
      LEFT JOIN departments d ON u.departmentId = d.id
      WHERE u.id = ?
    `, [newUserId]);

    res.status(201).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      error: 'Kullanıcı oluşturulamadı'
    });
  }
});

// PUT /api/users/:id - Update user
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, role, password, facultyId, departmentId } = req.body;

  if (!name || !email || !role) {
    return res.status(400).json({
      success: false,
      error: 'İsim, e-posta ve rol gereklidir'
    });
  }

  if (!['admin', 'instructor', 'student'].includes(role)) {
    return res.status(400).json({
      success: false,
      error: 'Rol admin, instructor veya student olmalıdır'
    });
  }

  try {
    // Check if user exists
    const existing = await dbGet('SELECT id, role FROM users WHERE id = ?', [Number(id)]);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Kullanıcı bulunamadı'
      });
    }

    // Check if email conflicts with another user
    const emailConflict = await dbGet(
      'SELECT id FROM users WHERE email = ? AND id != ?',
      [email, Number(id)]
    );
    if (emailConflict) {
      return res.status(409).json({
        success: false,
        error: 'E-posta başka bir kullanıcı tarafından kullanılıyor'
      });
    }

    // Build update query
    let updateQuery = 'UPDATE users SET name = ?, email = ?, role = ?, facultyId = ?, departmentId = ?';
    const params: any[] = [name, email, role, facultyId || null, departmentId || null];

    if (password) {
      const hashedPassword = await hashPassword(password);
      updateQuery += ', password = ?';
      params.push(hashedPassword);
    }

    updateQuery += ' WHERE id = ?';
    params.push(Number(id));

    await dbRun(updateQuery, params);

    // Get updated user
    const userId = Number(id);
    const user = await dbGet(`
      SELECT u.id, u.name, u.email, u.role, u.facultyId, u.departmentId, u.createdAt,
             f.name as facultyName,
             d.name as departmentName
      FROM users u
      LEFT JOIN faculties f ON u.facultyId = f.id
      LEFT JOIN departments d ON u.departmentId = d.id
      WHERE u.id = ?
    `, [userId]);

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      error: 'Kullanıcı güncellenemedi'
    });
  }
});

// DELETE /api/users/:id - Delete user
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  // Prevent deleting yourself
  if (req.session.user && req.session.user.id === Number(id)) {
    return res.status(400).json({
      success: false,
      error: 'Cannot delete your own account'
    });
  }

  try {
    // Check if user exists
    const existing = await dbGet('SELECT id FROM users WHERE id = ?', [Number(id)]);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    await dbRun('DELETE FROM users WHERE id = ?', [Number(id)]);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete user'
    });
  }
});

export default router;
