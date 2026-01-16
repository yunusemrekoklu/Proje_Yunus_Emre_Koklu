import express from 'express';
import { dbAll, dbGet, dbRun } from '../db/schema';
import { requireAuth } from '../middleware/auth';

const router = express.Router();

// POST /api/courses/:courseId/enroll - Request enrollment in a course
router.post('/courses/:courseId/enroll', requireAuth, async (req, res) => {
  const { courseId } = req.params;
  const userId = req.session.user!.id;

  try {
    // Check if course exists
    const course = await dbGet('SELECT id, title FROM courses WHERE id = ?', [Number(courseId)]);
    if (!course) {
      return res.status(404).json({
        success: false,
        error: 'Ders bulunamadı'
      });
    }

    // Check if already enrolled
    const enrolled = await dbGet(
      'SELECT * FROM course_enrollments WHERE courseId = ? AND studentId = ?',
      [Number(courseId), userId]
    );
    if (enrolled) {
      return res.status(400).json({
        success: false,
        error: 'Bu derse zaten kayıtlısınız'
      });
    }

    // Check if there's a pending request
    const pendingRequest = await dbGet(
      `SELECT * FROM course_enrollment_requests
       WHERE courseId = ? AND studentId = ? AND status = 'pending'`,
      [Number(courseId), userId]
    );
    if (pendingRequest) {
      return res.status(400).json({
        success: false,
        error: 'Bu ders için zaten kayıt talebiniz bulunmaktadır'
      });
    }

    // Create enrollment request
    const result = await dbRun(
      `INSERT INTO course_enrollment_requests (courseId, studentId, status, createdAt, updatedAt)
       VALUES (?, ?, 'pending', datetime("now"), datetime("now"))`,
      [Number(courseId), userId]
    );

    // Get request with course details
    const request = await dbGet(`
      SELECT cer.id, cer.courseId, cer.studentId, cer.status, cer.createdAt,
             c.title as courseTitle,
             c.instructorId,
             u.name as instructorName,
             s.name as studentName
      FROM course_enrollment_requests cer
      JOIN courses c ON cer.courseId = c.id
      JOIN users u ON c.instructorId = u.id
      JOIN users s ON cer.studentId = s.id
      WHERE cer.id = ?
    `, [result.lastInsertRowid]);

    res.status(201).json({
      success: true,
      data: request,
      message: 'Kayıt talebi oluşturuldu'
    });
  } catch (error) {
    console.error('Error creating enrollment request:', error);
    res.status(500).json({
      success: false,
      error: 'Kayıt talebi oluşturulamadı'
    });
  }
});

// GET /api/enrollments/requests - Get enrollment requests (instructor only)
router.get('/requests', requireAuth, async (req, res) => {
  const user = req.session.user!;

  // Only instructors can see enrollment requests
  if (user.role !== 'instructor' && user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Yetkiniz yok'
    });
  }

  try {
    let requests;

    if (user.role === 'instructor') {
      // Instructors see requests for their courses
      requests = await dbAll(`
        SELECT cer.id, cer.courseId, cer.studentId, cer.status, cer.createdAt,
               c.title as courseTitle,
               s.name as studentName, s.email as studentEmail,
               f.name as facultyName,
               d.name as departmentName
        FROM course_enrollment_requests cer
        JOIN courses c ON cer.courseId = c.id
        JOIN users s ON cer.studentId = s.id
        LEFT JOIN faculties f ON s.facultyId = f.id
        LEFT JOIN departments d ON s.departmentId = d.id
        WHERE c.instructorId = ? AND cer.status = 'pending'
        ORDER BY cer.createdAt DESC
      `, [user.id]);
    } else {
      // Admins see all requests
      requests = await dbAll(`
        SELECT cer.id, cer.courseId, cer.studentId, cer.status, cer.createdAt,
               c.title as courseTitle,
               s.name as studentName, s.email as studentEmail,
               f.name as facultyName,
               d.name as departmentName
        FROM course_enrollment_requests cer
        JOIN courses c ON cer.courseId = c.id
        JOIN users s ON cer.studentId = s.id
        LEFT JOIN faculties f ON s.facultyId = f.id
        LEFT JOIN departments d ON s.departmentId = d.id
        WHERE cer.status = 'pending'
        ORDER BY cer.createdAt DESC
      `);
    }

    res.json({
      success: true,
      data: requests
    });
  } catch (error) {
    console.error('Error fetching enrollment requests:', error);
    res.status(500).json({
      success: false,
      error: 'Kayıt talepleri getirilemedi'
    });
  }
});

// GET /api/enrollments/my-requests - Get current user's enrollment requests
router.get('/my-requests', requireAuth, async (req, res) => {
  const userId = req.session.user!.id;

  try {
    const requests = await dbAll(`
      SELECT cer.id, cer.courseId, cer.studentId, cer.status, cer.createdAt,
             c.title as courseTitle,
             c.instructorId,
             u.name as instructorName,
             f.name as facultyName,
             d.name as departmentName
      FROM course_enrollment_requests cer
      JOIN courses c ON cer.courseId = c.id
      JOIN users u ON c.instructorId = u.id
      LEFT JOIN faculties f ON c.facultyId = f.id
      LEFT JOIN departments d ON c.departmentId = d.id
      WHERE cer.studentId = ?
      ORDER BY cer.createdAt DESC
    `, [userId]);

    res.json({
      success: true,
      data: requests
    });
  } catch (error) {
    console.error('Error fetching my requests:', error);
    res.status(500).json({
      success: false,
      error: 'Talepleriniz getirilemedi'
    });
  }
});

// PUT /api/enrollments/requests/:requestId - Approve or reject enrollment request
router.put('/requests/:requestId', requireAuth, async (req, res) => {
  const { requestId } = req.params;
  const { status } = req.body; // 'approved' or 'rejected'
  const user = req.session.user!;

  if (user.role !== 'instructor' && user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Yetkiniz yok'
    });
  }

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({
      success: false,
      error: 'Geçersiz durum'
    });
  }

  try {
    // Get request details
    const request = await dbGet(
      'SELECT * FROM course_enrollment_requests WHERE id = ?',
      [Number(requestId)]
    );

    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Talep bulunamadı'
      });
    }

    // Check if instructor has permission (for this course)
    if (user.role === 'instructor') {
      const course = await dbGet(
        'SELECT * FROM courses WHERE id = ? AND instructorId = ?',
        [request.courseId, user.id]
      );
      if (!course) {
        return res.status(403).json({
          success: false,
          error: 'Bu derse yetkiniz yok'
        });
      }
    }

    // Update request status
    await dbRun(
      `UPDATE course_enrollment_requests
       SET status = ?, updatedAt = datetime("now")
       WHERE id = ?`,
      [status, Number(requestId)]
    );

    // If approved, add to enrollments
    if (status === 'approved') {
      await dbRun(
        'INSERT INTO course_enrollments (courseId, studentId) VALUES (?, ?)',
        [request.courseId, request.studentId]
      );
    }

    res.json({
      success: true,
      message: status === 'approved' ? 'Kayıt onaylandı' : 'Kayıt reddedildi'
    });
  } catch (error) {
    console.error('Error updating enrollment request:', error);
    res.status(500).json({
      success: false,
      error: 'Talep güncellenemedi'
    });
  }
});

// GET /api/enrollments/my-courses - Get current user's enrolled courses
router.get('/my-courses', requireAuth, async (req, res) => {
  const userId = req.session.user!.id;

  try {
    const courses = await dbAll(`
      SELECT c.id, c.title, c.instructorId, c.facultyId, c.departmentId,
             u.name as instructorName,
             f.name as facultyName,
             d.name as departmentName
      FROM course_enrollments ce
      JOIN courses c ON ce.courseId = c.id
      JOIN users u ON c.instructorId = u.id
      LEFT JOIN faculties f ON c.facultyId = f.id
      LEFT JOIN departments d ON c.departmentId = d.id
      WHERE ce.studentId = ?
      ORDER BY c.title
    `, [userId]);

    res.json({
      success: true,
      data: courses
    });
  } catch (error) {
    console.error('Error fetching enrolled courses:', error);
    res.status(500).json({
      success: false,
      error: 'Kayıtlı dersler getirilemedi'
    });
  }
});

// GET /api/courses/available - Get available courses for enrollment
router.get('/courses/available', requireAuth, async (req, res) => {
  const user = req.session.user!;

  try {
    const courses = await dbAll(`
      SELECT c.id, c.title, c.instructorId, c.facultyId, c.departmentId,
             u.name as instructorName,
             f.name as facultyName,
             d.name as departmentName,
             COUNT(ce.studentId) as enrollmentCount
      FROM courses c
      JOIN users u ON c.instructorId = u.id
      LEFT JOIN faculties f ON c.facultyId = f.id
      LEFT JOIN departments d ON c.departmentId = d.id
      LEFT JOIN course_enrollments ce ON c.id = ce.courseId
      GROUP BY c.id
      HAVING c.id NOT IN (
        SELECT courseId FROM course_enrollments WHERE studentId = ?
      )
      AND c.id NOT IN (
        SELECT courseId FROM course_enrollment_requests
        WHERE studentId = ? AND status = 'pending'
      )
      ORDER BY c.title
    `, [user.id, user.id]);

    res.json({
      success: true,
      data: courses
    });
  } catch (error) {
    console.error('Error fetching available courses:', error);
    res.status(500).json({
      success: false,
      error: 'Dersler getirilemedi'
    });
  }
});

export default router;
