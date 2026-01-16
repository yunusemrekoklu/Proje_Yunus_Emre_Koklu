import express from 'express';
import { dbGet, dbRun } from '../db/schema';
import { verifyPassword, hashPassword, SessionUser } from '../services/auth';

const router = express.Router();

interface LoginRequest {
  email: string;
  password: string;
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password }: LoginRequest = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Email and password are required'
    });
  }

  try {
    // Find user by email
    const user = await dbGet(
      'SELECT id, name, email, password, role, createdAt FROM users WHERE email = ?',
      [email]
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Set session
    const sessionUser: SessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt
    };

    req.session.user = sessionUser;

    res.json({
      success: true,
      data: sessionUser
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({
        success: false,
        error: 'Logout failed'
      });
    }

    res.clearCookie('connect.sid');
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({
      success: false,
      error: 'Not authenticated'
    });
  }

  res.json({
    success: true,
    data: req.session.user
  });
});

// POST /api/auth/register - Student self-registration
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      error: 'İsim, e-posta ve şifre gereklidir'
    });
  }

  // Validate student email domain
  if (!email.endsWith('@ogr.atu.edu.tr')) {
    return res.status(400).json({
      success: false,
      error: 'Öğrenci kaydı için sadece @ogr.atu.edu.tr uzantılı e-posta adresleri kullanılabilir'
    });
  }

  try {
    // Check if email already exists
    const existing = await dbGet('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Bu e-posta adresi zaten kullanımda'
      });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create student account (role is hardcoded to 'student')
    const result = await dbRun(
      'INSERT INTO users (name, email, password, role, facultyId, departmentId, createdAt) VALUES (?, ?, ?, ?, ?, ?, datetime("now"))',
      [name, email, hashedPassword, 'student', null, null]
    );

    // Get created user
    const user = await dbGet(
      'SELECT id, name, email, role, createdAt FROM users WHERE id = ?',
      [result.lastInsertRowid]
    );

    // Auto-login after registration
    const sessionUser: SessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt
    };

    req.session.user = sessionUser;

    res.status(201).json({
      success: true,
      data: sessionUser,
      message: 'Kayıt başarılı'
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Kayıt başarısız'
    });
  }
});

export default router;
