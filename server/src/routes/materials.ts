import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { dbAll, dbGet, dbRun } from '../db/schema';
import {
  validateFileType,
  validateFileSize,
  validateFileName,
  mockVirusScan,
  checkDuplicateFile,
  getNextVersion,
  ensureCourseStorage,
  ensureTempStorage,
  generateStoredName,
  saveFileMetadata,
  moveFileToFinalLocation,
  deleteTempFile,
  sendNotifications
} from '../services/fileUpload';

const router = express.Router();

// Configure multer for temp storage
const upload = multer({
  dest: path.join(process.cwd(), './storage/tmp'),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB (will also validate in code for better error messages)
  }
});

// GET /api/courses/:courseId/materials
router.get('/courses/:courseId/materials', async (req, res) => {
  const { courseId } = req.params;

  try {
    const materials = await dbAll(`
      SELECT id, courseId, instructorId, originalName, storedName, description, mimeType, sizeBytes, version, createdAt
      FROM materials
      WHERE courseId = ?
      ORDER BY originalName, version DESC
    `, [Number(courseId)]);

    res.json({
      success: true,
      data: materials
    });
  } catch (error) {
    console.error('Error fetching materials:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch materials'
    });
  }
});

// Helper function to check duplicate
async function checkDuplicateInDb(courseId: number, originalName: string): Promise<{ exists: boolean; version?: number }> {
  const existing = await dbGet(
    'SELECT id, version FROM materials WHERE courseId = ? AND originalName = ? ORDER BY version DESC LIMIT 1',
    [courseId, originalName]
  );

  if (existing) {
    return { exists: true, version: existing.version as number };
  }

  return { exists: false };
}

// Helper function to get next version
async function getNextVersionFromDb(courseId: number, originalName: string): Promise<number> {
  const latest = await dbGet(
    'SELECT version FROM materials WHERE courseId = ? AND originalName = ? ORDER BY version DESC LIMIT 1',
    [courseId, originalName]
  );

  return latest ? (latest.version as number) + 1 : 1;
}

// POST /api/courses/:courseId/materials/upload
router.post('/courses/:courseId/materials/upload', upload.single('file'), async (req, res) => {
  const { courseId } = req.params;
  const { description, duplicatePolicy = 'cancel' } = req.body;
  const file = req.file;

  const courseIdNum = Number(courseId);
  const instructorId = Number(req.body.instructorId || 1); // Default to instructor 1 for demo

  // Validate file exists
  if (!file) {
    return res.status(400).json({
      success: false,
      error: 'No file uploaded'
    });
  }

  // Validate file name
  const nameValidation = validateFileName(file.originalname);
  if (!nameValidation.valid) {
    deleteTempFile(file.path);
    return res.status(400).json({
      success: false,
      error: nameValidation.error
    });
  }

  // Validate file type
  const typeValidation = validateFileType(file.originalname, file.mimetype);
  if (!typeValidation.valid) {
    deleteTempFile(file.path);
    return res.status(400).json({
      success: false,
      error: typeValidation.error
    });
  }

  // Validate file size
  const sizeValidation = validateFileSize(file.size);
  if (!sizeValidation.valid) {
    deleteTempFile(file.path);
    return res.status(400).json({
      success: false,
      error: sizeValidation.error
    });
  }

  // Mock virus scan
  const virusScanResult = mockVirusScan(file.originalname);
  if (!virusScanResult.valid) {
    deleteTempFile(file.path);
    return res.status(403).json({
      success: false,
      error: virusScanResult.error
    });
  }

  // Check for duplicate
  const duplicateCheck = await checkDuplicateInDb(courseIdNum, file.originalname);

  let finalVersion = 1;
  let shouldProceed = true;

  if (duplicateCheck.exists) {
    // Handle duplicate based on policy
    if (duplicatePolicy === 'cancel') {
      deleteTempFile(file.path);
      return res.status(409).json({
        success: false,
        error: 'A file with this name already exists. Please choose a policy: overwrite, version, or cancel.',
        duplicateExists: true
      });
    } else if (duplicatePolicy === 'version') {
      finalVersion = await getNextVersionFromDb(courseIdNum, file.originalname);
    } else if (duplicatePolicy === 'overwrite') {
      finalVersion = duplicateCheck.version || 1;
    }
  }

  // Generate stored name
  const storedName = generateStoredName(file.originalname, finalVersion);

  // Ensure course storage exists
  try {
    const courseDir = ensureCourseStorage(courseIdNum);

    // Move file from temp to final location
    const finalPath = path.join(courseDir, storedName);
    moveFileToFinalLocation(file.path, finalPath);

    // Save metadata to database
    const result = await dbRun(`
      INSERT INTO materials (courseId, instructorId, originalName, storedName, description, mimeType, sizeBytes, version, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `, [
      courseIdNum,
      instructorId,
      file.originalname,
      storedName,
      description || '',
      file.mimetype,
      file.size,
      finalVersion
    ]);

    const materialId = result.lastInsertRowid;

    // Send notifications
    await sendNotifications(courseIdNum, file.originalname);

    res.json({
      success: true,
      message: 'File uploaded successfully.',
      data: {
        id: materialId,
        originalName: file.originalname,
        storedName,
        version: finalVersion
      }
    });
  } catch (error) {
    console.error('Error saving file:', error);

    // Clean up temp file if it still exists
    deleteTempFile(file.path);

    res.status(500).json({
      success: false,
      error: 'Failed to save file. Storage error occurred.'
    });
  }
});

// DELETE /api/materials/:id
router.delete('/materials/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Get material info
    const material = await dbGet('SELECT * FROM materials WHERE id = ?', [Number(id)]);

    if (!material) {
      return res.status(404).json({
        success: false,
        error: 'Material not found'
      });
    }

    // Delete file from storage
    const filePath = path.join(process.cwd(), './storage', `course_${material.courseId}`, material.storedName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from database
    await dbRun('DELETE FROM materials WHERE id = ?', [Number(id)]);

    res.json({
      success: true,
      message: 'Material deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting material:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete material'
    });
  }
});

export default router;
