import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { dbAll, dbGet, dbRun } from '../db/schema';
import { requireAuth } from '../middleware/auth';

const router = express.Router();

// Configure multer for temp storage
const upload = multer({
  dest: path.join(process.cwd(), './storage/tmp'),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  }
});

// Helper: Generate stored name for lecture notes
function generateNoteName(originalName: string): string {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9]/g, '_');
  return `${baseName}_${timestamp}_${randomStr}${ext}`;
}

// GET /api/courses/:courseId/notes - Get all lecture notes for a course
router.get('/courses/:courseId/notes', async (req, res) => {
  const { courseId } = req.params;

  try {
    const notes = await dbAll(`
      SELECT n.id, n.courseId, n.uploaderId, n.originalName, n.storedName,
             n.description, n.mimeType, n.sizeBytes, n.createdAt,
             u.name as uploaderName, u.role as uploaderRole
      FROM lecture_notes n
      JOIN users u ON n.uploaderId = u.id
      WHERE n.courseId = ?
      ORDER BY n.createdAt DESC
    `, [Number(courseId)]);

    res.json({ success: true, data: notes });
  } catch (error) {
    console.error('Error fetching lecture notes:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch lecture notes' });
  }
});

// POST /api/courses/:courseId/notes - Upload lecture note
router.post('/courses/:courseId/notes', requireAuth, upload.single('file'), async (req, res) => {
  const { courseId } = req.params;
  const { description } = req.body;
  const file = req.file;
  const userId = req.session.user!.id;

  // Validate file exists
  if (!file) {
    return res.status(400).json({ success: false, error: 'No file uploaded' });
  }

  // Validate file type (PDF/DOCX only for lecture notes)
  const allowedTypes = ['.pdf', '.docx'];
  const fileExt = path.extname(file.originalname).toLowerCase();

  if (!allowedTypes.includes(fileExt)) {
    // Clean up temp file
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    return res.status(400).json({
      success: false,
      error: 'Only PDF and DOCX files are allowed for lecture notes'
    });
  }

  // Validate file size (100MB max)
  if (file.size > 100 * 1024 * 1024) {
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    return res.status(400).json({
      success: false,
      error: 'File too large. Maximum size is 100MB'
    });
  }

  try {
    const courseIdNum = Number(courseId);

    // Verify course exists
    const course = await dbGet('SELECT id FROM courses WHERE id = ?', [courseIdNum]);
    if (!course) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(404).json({ success: false, error: 'Course not found' });
    }

    // Create course directory if it doesn't exist
    const courseDir = path.join(process.cwd(), './storage', `course_${courseIdNum}`);
    if (!fs.existsSync(courseDir)) {
      fs.mkdirSync(courseDir, { recursive: true });
    }

    // Generate unique stored name
    const storedName = generateNoteName(file.originalname);
    const finalPath = path.join(courseDir, storedName);

    // Move file from temp to final location
    fs.renameSync(file.path, finalPath);

    // Save metadata to database
    const result = await dbRun(`
      INSERT INTO lecture_notes (courseId, uploaderId, originalName, storedName, description, mimeType, sizeBytes, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `, [courseIdNum, userId, file.originalname, storedName, description || '', file.mimetype, file.size]);

    res.json({
      success: true,
      message: 'Lecture note uploaded successfully',
      data: { id: result.lastInsertRowid }
    });
  } catch (error) {
    console.error('Error uploading lecture note:', error);
    // Clean up temp file if it exists
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    res.status(500).json({ success: false, error: 'Failed to upload lecture note' });
  }
});

// GET /api/notes/:noteId/download - Download lecture note
router.get('/notes/:noteId/download', requireAuth, async (req, res) => {
  const { noteId } = req.params;

  try {
    const note = await dbGet('SELECT * FROM lecture_notes WHERE id = ?', [Number(noteId)]);

    if (!note) {
      return res.status(404).json({ success: false, error: 'Lecture note not found' });
    }

    const filePath = path.join(process.cwd(), './storage', `course_${note.courseId}`, note.storedName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'File not found on disk' });
    }

    // Send file for download
    res.download(filePath, note.originalName);
  } catch (error) {
    console.error('Error downloading lecture note:', error);
    res.status(500).json({ success: false, error: 'Failed to download lecture note' });
  }
});

// DELETE /api/notes/:noteId - Delete lecture note (owner or admin only)
router.delete('/notes/:noteId', requireAuth, async (req, res) => {
  const { noteId } = req.params;
  const userId = req.session.user!.id;
  const userRole = req.session.user!.role;

  try {
    const note = await dbGet('SELECT * FROM lecture_notes WHERE id = ?', [Number(noteId)]);

    if (!note) {
      return res.status(404).json({ success: false, error: 'Lecture note not found' });
    }

    // Check ownership or admin
    if (note.uploaderId !== userId && userRole !== 'admin') {
      return res.status(403).json({ success: false, error: 'Not authorized to delete this note' });
    }

    // Delete file from disk
    const filePath = path.join(process.cwd(), './storage', `course_${note.courseId}`, note.storedName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from database
    await dbRun('DELETE FROM lecture_notes WHERE id = ?', [Number(noteId)]);

    // Also delete associated ratings
    await dbRun('DELETE FROM lecture_note_ratings WHERE noteId = ?', [Number(noteId)]);

    res.json({ success: true, message: 'Lecture note deleted successfully' });
  } catch (error) {
    console.error('Error deleting lecture note:', error);
    res.status(500).json({ success: false, error: 'Failed to delete lecture note' });
  }
});

export default router;
