import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { dbAll, dbGet } from '../db/schema';

export interface FileMetadata {
  courseId: number;
  instructorId: number;
  originalName: string;
  storedName: string;
  description: string;
  mimeType: string;
  sizeBytes: number;
  version: number;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// Validate file type
export function validateFileType(fileName: string, mimeType: string): ValidationResult {
  const ext = path.extname(fileName).toLowerCase();

  if (!config.allowedExtensions.includes(ext)) {
    return {
      valid: false,
      error: `Unsupported file type. Allowed formats: PDF, DOCX, PPTX, XLSX, ZIP.`
    };
  }

  if (!config.allowedMimeTypes.includes(mimeType)) {
    return {
      valid: false,
      error: `Unsupported file type. Allowed formats: PDF, DOCX, PPTX, XLSX, ZIP.`
    };
  }

  return { valid: true };
}

// Validate file size
export function validateFileSize(sizeBytes: number): ValidationResult {
  const maxSizeBytes = config.maxFileSizeMB * 1024 * 1024;

  if (sizeBytes > maxSizeBytes) {
    return {
      valid: false,
      error: `File too large. Maximum allowed size is ${config.maxFileSizeMB}MB.`
    };
  }

  return { valid: true };
}

// Validate file name
export function validateFileName(fileName: string): ValidationResult {
  // Check if empty
  if (!fileName || fileName.trim() === '') {
    return {
      valid: false,
      error: 'File name cannot be empty.'
    };
  }

  // Check length
  if (fileName.length > config.maxFileNameLength) {
    return {
      valid: false,
      error: `File name too long. Maximum allowed length is ${config.maxFileNameLength} characters.`
    };
  }

  // Check for path traversal
  const normalizedPath = path.normalize(fileName);
  if (normalizedPath !== fileName || fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    return {
      valid: false,
      error: 'Invalid file name. Path traversal characters are not allowed.'
    };
  }

  return { valid: true };
}

// Mock virus scan
export function mockVirusScan(fileName: string): ValidationResult {
  const lowerFileName = fileName.toLowerCase();

  // If filename contains "virus", consider it infected
  if (lowerFileName.includes('virus')) {
    return {
      valid: false,
      error: 'Upload blocked: File failed virus scan.'
    };
  }

  return { valid: true };
}

// Create storage directory for course
export function ensureCourseStorage(courseId: number): string {
  const courseDir = path.join(process.cwd(), config.storagePath, `course_${courseId}`);

  if (!fs.existsSync(courseDir)) {
    fs.mkdirSync(courseDir, { recursive: true });
  }

  return courseDir;
}

// Create temporary storage directory
export function ensureTempStorage(): string {
  const tempDir = path.join(process.cwd(), config.tmpPath);

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  return tempDir;
}

// Generate stored file name
export function generateStoredName(originalName: string, version: number): string {
  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext);

  if (version === 1) {
    return `${baseName}${ext}`;
  }

  return `${baseName}__v${version}${ext}`;
}

// Move file from temp to final destination
export function moveFileToFinalLocation(tempPath: string, finalPath: string): void {
  fs.renameSync(tempPath, finalPath);
}

// Delete file from temp directory
export function deleteTempFile(tempPath: string): void {
  if (fs.existsSync(tempPath)) {
    fs.unlinkSync(tempPath);
  }
}

// Clean up orphaned temp files
export function cleanupTempFiles(): void {
  const tempDir = path.join(process.cwd(), config.tmpPath);

  if (!fs.existsSync(tempDir)) {
    return;
  }

  const files = fs.readdirSync(tempDir);
  let cleanedCount = 0;

  for (const file of files) {
    const filePath = path.join(tempDir, file);
    try {
      const stats = fs.statSync(filePath);
      // Delete files older than 1 hour
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      if (stats.mtimeMs < oneHourAgo) {
        fs.unlinkSync(filePath);
        cleanedCount++;
      }
    } catch (error) {
      console.error(`Error deleting temp file ${file}:`, error);
    }
  }

  if (cleanedCount > 0) {
    console.log(`Cleaned up ${cleanedCount} orphaned temp file(s)`);
  }
}

// Send notifications (mock - console log)
export async function sendNotifications(courseId: number, materialName: string): Promise<void> {
  if (!config.notificationsEnabled) {
    return;
  }

  // Get enrolled students
  const students = await dbAll(`
    SELECT s.name, s.email
    FROM students s
    JOIN enrollments e ON s.id = e.studentId
    WHERE e.courseId = ?
  `, [courseId]) as { name: string; email: string }[];

  // Get course title
  const course = await dbGet('SELECT title FROM courses WHERE id = ?', [courseId]) as { title: string } | undefined;

  console.log(`\n=== NOTIFICATION: New material uploaded ===`);
  console.log(`Course: ${course?.title || 'Unknown'} (ID: ${courseId})`);
  console.log(`Material: ${materialName}`);
  console.log(`Notifying ${students.length} student(s):`);

  for (const student of students) {
    console.log(`  - ${student.name} (${student.email})`);
  }
  console.log(`==========================================\n`);
}
