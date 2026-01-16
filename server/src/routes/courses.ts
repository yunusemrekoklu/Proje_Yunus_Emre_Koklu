import express from 'express';
import { dbAll, dbGet, dbRun } from '../db/schema';

const router = express.Router();

// GET /api/courses?instructorId=1 or ?studentId=1 or (no params for admin)
router.get('/', async (req, res) => {
  const { instructorId, studentId } = req.query;

  try {
    let courses;

    if (instructorId) {
      // Get courses for instructor
      if (isNaN(Number(instructorId))) {
        return res.status(400).json({
          success: false,
          error: 'Valid instructorId is required'
        });
      }

      courses = await dbAll(`
        SELECT c.id, c.title, c.instructorId, u.name as instructorName, u.email as instructorEmail
        FROM courses c
        JOIN users u ON c.instructorId = u.id
        WHERE c.instructorId = ?
        ORDER BY c.title
      `, [Number(instructorId)]);
    } else if (studentId) {
      // Get courses for student (enrolled courses)
      if (isNaN(Number(studentId))) {
        return res.status(400).json({
          success: false,
          error: 'Valid studentId is required'
        });
      }

      courses = await dbAll(`
        SELECT c.id, c.title, c.instructorId, u.name as instructorName, u.email as instructorEmail
        FROM courses c
        JOIN users u ON c.instructorId = u.id
        JOIN course_enrollments ce ON c.id = ce.courseId
        WHERE ce.studentId = ?
        ORDER BY c.title
      `, [Number(studentId)]);
    } else {
      // Get all courses (for admin)
      courses = await dbAll(`
        SELECT c.id, c.title, c.instructorId, u.name as instructorName, u.email as instructorEmail
        FROM courses c
        JOIN users u ON c.instructorId = u.id
        ORDER BY c.title
      `);
    }

    res.json({
      success: true,
      data: courses
    });
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch courses'
    });
  }
});

// GET /api/courses/:courseId
router.get('/:courseId', async (req, res) => {
  const { courseId } = req.params;

  try {
    const course = await dbGet(`
      SELECT c.id, c.title, c.instructorId, i.name as instructorName
      FROM courses c
      JOIN instructors i ON c.instructorId = i.id
      WHERE c.id = ?
    `, [Number(courseId)]);

    if (!course) {
      return res.status(404).json({
        success: false,
        error: 'Course not found'
      });
    }

    res.json({
      success: true,
      data: course
    });
  } catch (error) {
    console.error('Error fetching course:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch course'
    });
  }
});

// POST /api/courses - Create a new course
router.post('/', async (req, res) => {
  const { title, instructorId, facultyId, departmentId } = req.body;

  // Validation
  if (!title || !instructorId || !facultyId || !departmentId) {
    return res.status(400).json({
      success: false,
      error: 'Title, instructorId, facultyId, and departmentId are required'
    });
  }

  if (isNaN(Number(instructorId)) || isNaN(Number(facultyId)) || isNaN(Number(departmentId))) {
    return res.status(400).json({
      success: false,
      error: 'Invalid instructorId, facultyId, or departmentId'
    });
  }

  try {
    // Check if instructor exists and is actually an instructor
    const instructor = await dbGet('SELECT id, role FROM users WHERE id = ?', [Number(instructorId)]);
    if (!instructor) {
      return res.status(404).json({
        success: false,
        error: 'Instructor not found'
      });
    }
    if (instructor.role !== 'instructor') {
      return res.status(400).json({
        success: false,
        error: 'User is not an instructor'
      });
    }

    // Check if faculty and department exist
    const faculty = await dbGet('SELECT id FROM faculties WHERE id = ?', [Number(facultyId)]);
    if (!faculty) {
      return res.status(404).json({
        success: false,
        error: 'Faculty not found'
      });
    }

    const department = await dbGet('SELECT id FROM departments WHERE id = ?', [Number(departmentId)]);
    if (!department) {
      return res.status(404).json({
        success: false,
        error: 'Department not found'
      });
    }

    // Create the course
    const result = await dbRun(
      'INSERT INTO courses (title, instructorId, facultyId, departmentId) VALUES (?, ?, ?, ?)',
      [title, Number(instructorId), Number(facultyId), Number(departmentId)]
    );

    // Fetch the created course with instructor details
    const course = await dbGet(`
      SELECT c.id, c.title, c.instructorId, u.name as instructorName, u.email as instructorEmail
      FROM courses c
      JOIN users u ON c.instructorId = u.id
      WHERE c.id = ?
    `, [result.lastInsertRowid]);

    res.status(201).json({
      success: true,
      data: course
    });
  } catch (error) {
    console.error('Error creating course:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create course'
    });
  }
});

// DELETE /api/courses/:courseId - Delete a course
router.delete('/:courseId', async (req, res) => {
  const { courseId } = req.params;

  try {
    // Check if course exists
    const course = await dbGet('SELECT id FROM courses WHERE id = ?', [Number(courseId)]);
    if (!course) {
      return res.status(404).json({
        success: false,
        error: 'Course not found'
      });
    }

    // Delete the course (materials will be deleted due to FK constraint if set up correctly)
    await dbRun('DELETE FROM courses WHERE id = ?', [Number(courseId)]);

    res.json({
      success: true,
      message: 'Course deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting course:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete course'
    });
  }
});

export default router;
