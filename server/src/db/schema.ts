import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { hashPassword } from '../services/auth';

const DB_PATH = path.join(process.cwd(), 'server/db.sqlite');

let db: Database | null = null;

// Load or create database
async function loadDatabase(): Promise<Database> {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    return new SQL.Database(buffer);
  } else {
    const newDb = new SQL.Database();
    saveDatabase(newDb);
    return newDb;
  }
}

// Save database to disk
function saveDatabase(database: Database): void {
  const data = database.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// Get database instance
export async function getDatabase(): Promise<Database> {
  if (!db) {
    db = await loadDatabase();
  }
  return db;
}

// Execute a query and return all rows
export async function dbAll(query: string, params: any[] = []): Promise<any[]> {
  const database = await getDatabase();
  const stmt = database.prepare(query);
  stmt.bind(params);

  const results: any[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push(row);
  }
  stmt.free();

  return results;
}

// Execute a query and return first row
export async function dbGet(query: string, params: any[] = []): Promise<any> {
  const results = await dbAll(query, params);
  return results.length > 0 ? results[0] : null;
}

// Execute a query that modifies data (INSERT, UPDATE, DELETE)
export async function dbRun(query: string, params: any[] = []): Promise<{ lastInsertRowid: number; changes: number }> {
  const database = await getDatabase();
  database.run(query, params);
  saveDatabase(database);

  // Get last insert rowid
  const lastIdResult = await dbGet('SELECT last_insert_rowid() as id');
  return {
    lastInsertRowid: lastIdResult?.id || 0,
    changes: database.getRowsModified()
  };
}

// Check if a table exists
function tableExists(database: Database, tableName: string): boolean {
  const stmt = database.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
  );
  stmt.bind([tableName]);
  const exists = stmt.step();
  stmt.free();
  return exists;
}

// Create tables
export async function initializeDatabase(): Promise<void> {
  const database = await getDatabase();

  // Check if we need to migrate (if instructors table exists but users doesn't)
  const needsMigration = tableExists(database, 'instructors') && !tableExists(database, 'users');

  if (needsMigration) {
    console.log('Detected old database schema, running migration...');
    await migrateDatabase(database);
    return;
  }

  // Users table (unified authentication)
  database.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'instructor', 'student')),
      facultyId INTEGER,
      departmentId INTEGER,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (facultyId) REFERENCES faculties(id),
      FOREIGN KEY (departmentId) REFERENCES departments(id)
    )
  `);

  // Faculties table
  database.run(`
    CREATE TABLE IF NOT EXISTS faculties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      createdAt TEXT NOT NULL
    )
  `);

  // Departments table
  database.run(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      facultyId INTEGER NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (facultyId) REFERENCES faculties(id),
      UNIQUE(name, facultyId)
    )
  `);

  // Course enrollment requests table
  database.run(`
    CREATE TABLE IF NOT EXISTS course_enrollment_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      courseId INTEGER NOT NULL,
      studentId INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (courseId) REFERENCES courses(id),
      FOREIGN KEY (studentId) REFERENCES users(id),
      UNIQUE(courseId, studentId)
    )
  `);

  // Courses table
  database.run(`
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      instructorId INTEGER NOT NULL,
      facultyId INTEGER NOT NULL,
      departmentId INTEGER NOT NULL,
      FOREIGN KEY (instructorId) REFERENCES users(id),
      FOREIGN KEY (facultyId) REFERENCES faculties(id),
      FOREIGN KEY (departmentId) REFERENCES departments(id)
    )
  `);

  // Materials table
  database.run(`
    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      courseId INTEGER NOT NULL,
      instructorId INTEGER NOT NULL,
      originalName TEXT NOT NULL,
      storedName TEXT NOT NULL,
      description TEXT,
      mimeType TEXT NOT NULL,
      sizeBytes INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (courseId) REFERENCES courses(id),
      FOREIGN KEY (instructorId) REFERENCES users(id)
    )
  `);

  // Material ratings table
  database.run(`
    CREATE TABLE IF NOT EXISTS material_ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      materialId INTEGER NOT NULL,
      userId INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      comment TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (materialId) REFERENCES materials(id),
      FOREIGN KEY (userId) REFERENCES users(id),
      UNIQUE(materialId, userId)
    )
  `);

  // Material grades table
  database.run(`
    CREATE TABLE IF NOT EXISTS material_grades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      materialId INTEGER NOT NULL,
      userId INTEGER NOT NULL,
      grade INTEGER NOT NULL CHECK(grade >= 0 AND grade <= 100),
      createdAt TEXT NOT NULL,
      FOREIGN KEY (materialId) REFERENCES materials(id),
      FOREIGN KEY (userId) REFERENCES users(id),
      UNIQUE(materialId, userId)
    )
  `);

  // Course enrollments table
  database.run(`
    CREATE TABLE IF NOT EXISTS course_enrollments (
      courseId INTEGER NOT NULL,
      studentId INTEGER NOT NULL,
      PRIMARY KEY (courseId, studentId),
      FOREIGN KEY (courseId) REFERENCES courses(id),
      FOREIGN KEY (studentId) REFERENCES users(id)
    )
  `);

  // Lecture notes table
  database.run(`
    CREATE TABLE IF NOT EXISTS lecture_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      courseId INTEGER NOT NULL,
      uploaderId INTEGER NOT NULL,
      originalName TEXT NOT NULL,
      storedName TEXT NOT NULL,
      description TEXT,
      mimeType TEXT NOT NULL,
      sizeBytes INTEGER NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (courseId) REFERENCES courses(id),
      FOREIGN KEY (uploaderId) REFERENCES users(id)
    )
  `);

  // Lecture note ratings table
  database.run(`
    CREATE TABLE IF NOT EXISTS lecture_note_ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      noteId INTEGER NOT NULL,
      userId INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      comment TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (noteId) REFERENCES lecture_notes(id),
      FOREIGN KEY (userId) REFERENCES users(id),
      UNIQUE(noteId, userId)
    )
  `);

  saveDatabase(database);
  console.log('Database tables created successfully');
}

// Migrate from old schema to new schema
async function migrateDatabase(database: Database): Promise<void> {
  // Helper to run query and get all rows
  const getAll = (query: string, params: any[] = []): any[] => {
    const stmt = database.prepare(query);
    stmt.bind(params);
    const results: any[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  };

  // Helper to run query and get first row
  const getFirst = (query: string, params: any[] = []): any => {
    const results = getAll(query, params);
    return results.length > 0 ? results[0] : null;
  };

  // Save current data before dropping tables
  const oldInstructors = getAll('SELECT * FROM instructors');
  const oldStudents = getAll('SELECT * FROM students');
  const oldCourses = getAll('SELECT * FROM courses');
  const oldMaterials = getAll('SELECT * FROM materials');
  const oldEnrollments = getAll('SELECT * FROM enrollments');

  // Create new tables with faculty/department support
  database.run(`
    CREATE TABLE faculties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      createdAt TEXT NOT NULL
    )
  `);

  database.run(`
    CREATE TABLE departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      facultyId INTEGER NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (facultyId) REFERENCES faculties(id),
      UNIQUE(name, facultyId)
    )
  `);

  database.run(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'instructor', 'student')),
      facultyId INTEGER,
      departmentId INTEGER,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (facultyId) REFERENCES faculties(id),
      FOREIGN KEY (departmentId) REFERENCES departments(id)
    )
  `);

  // Migrate instructors to users
  const instructorIdMap = new Map<number, number>();
  for (const instructor of oldInstructors) {
    const hashedPassword = await hashPassword('instructor123');
    database.run(
      'INSERT INTO users (name, email, password, role, facultyId, departmentId, createdAt) VALUES (?, ?, ?, ?, ?, ?, datetime("now"))',
      [instructor.name, instructor.email, hashedPassword, 'instructor', null, null]
    );
    const newId = getFirst('SELECT last_insert_rowid() as id')?.id;
    if (newId) instructorIdMap.set(instructor.id, newId);
  }

  // Migrate students to users
  const studentIdMap = new Map<number, number>();
  for (const student of oldStudents) {
    const hashedPassword = await hashPassword('student123');
    database.run(
      'INSERT INTO users (name, email, password, role, facultyId, departmentId, createdAt) VALUES (?, ?, ?, ?, ?, ?, datetime("now"))',
      [student.name, student.email, hashedPassword, 'student', null, null]
    );
    const newId = getFirst('SELECT last_insert_rowid() as id')?.id;
    if (newId) studentIdMap.set(student.id, newId);
  }

  // Create default admin user
  const adminPassword = await hashPassword('admin123');
  database.run(
    'INSERT INTO users (name, email, password, role, facultyId, departmentId, createdAt) VALUES (?, ?, ?, ?, ?, ?, datetime("now"))',
    ['System Admin', 'admin@atu.edu.tr', adminPassword, 'admin', null, null]
  );

  // Recreate courses table with new FK
  database.run('DROP TABLE courses');
  database.run(`
    CREATE TABLE courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      instructorId INTEGER NOT NULL,
      facultyId INTEGER NOT NULL,
      departmentId INTEGER NOT NULL,
      FOREIGN KEY (instructorId) REFERENCES users(id),
      FOREIGN KEY (facultyId) REFERENCES faculties(id),
      FOREIGN KEY (departmentId) REFERENCES departments(id)
    )
  `);

  // Restore courses with new instructor IDs (set facultyId/departmentId to 1 for now)
  for (const course of oldCourses) {
    const newInstructorId = instructorIdMap.get(course.instructorId) || 1;
    database.run(
      'INSERT INTO courses (id, title, instructorId, facultyId, departmentId) VALUES (?, ?, ?, ?, ?)',
      [course.id, course.title, newInstructorId, 1, 1]
    );
  }

  // Recreate materials table with new FK
  database.run('DROP TABLE materials');
  database.run(`
    CREATE TABLE materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      courseId INTEGER NOT NULL,
      instructorId INTEGER NOT NULL,
      originalName TEXT NOT NULL,
      storedName TEXT NOT NULL,
      description TEXT,
      mimeType TEXT NOT NULL,
      sizeBytes INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (courseId) REFERENCES courses(id),
      FOREIGN KEY (instructorId) REFERENCES users(id)
    )
  `);

  // Restore materials with new instructor IDs
  for (const material of oldMaterials) {
    const newInstructorId = instructorIdMap.get(material.instructorId) || 1;
    database.run(
      'INSERT INTO materials (id, courseId, instructorId, originalName, storedName, description, mimeType, sizeBytes, version, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [material.id, material.courseId, newInstructorId, material.originalName, material.storedName, material.description, material.mimeType, material.sizeBytes, material.version, material.createdAt]
    );
  }

  // Recreate enrollments with new FK
  database.run('DROP TABLE enrollments');
  database.run(`
    CREATE TABLE course_enrollments (
      courseId INTEGER NOT NULL,
      studentId INTEGER NOT NULL,
      PRIMARY KEY (courseId, studentId),
      FOREIGN KEY (courseId) REFERENCES courses(id),
      FOREIGN KEY (studentId) REFERENCES users(id)
    )
  `);

  // Restore enrollments with new student IDs
  for (const enrollment of oldEnrollments) {
    const newStudentId = studentIdMap.get(enrollment.studentId);
    if (newStudentId) {
      database.run(
        'INSERT INTO course_enrollments (courseId, studentId) VALUES (?, ?)',
        [enrollment.courseId, newStudentId]
      );
    }
  }

  // Create new tables
  database.run(`
    CREATE TABLE material_ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      materialId INTEGER NOT NULL,
      userId INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      comment TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (materialId) REFERENCES materials(id),
      FOREIGN KEY (userId) REFERENCES users(id),
      UNIQUE(materialId, userId)
    )
  `);

  database.run(`
    CREATE TABLE material_grades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      materialId INTEGER NOT NULL,
      userId INTEGER NOT NULL,
      grade INTEGER NOT NULL CHECK(grade >= 0 AND grade <= 100),
      createdAt TEXT NOT NULL,
      FOREIGN KEY (materialId) REFERENCES materials(id),
      FOREIGN KEY (userId) REFERENCES users(id),
      UNIQUE(materialId, userId)
    )
  `);

  database.run(`
    CREATE TABLE lecture_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      courseId INTEGER NOT NULL,
      uploaderId INTEGER NOT NULL,
      originalName TEXT NOT NULL,
      storedName TEXT NOT NULL,
      description TEXT,
      mimeType TEXT NOT NULL,
      sizeBytes INTEGER NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (courseId) REFERENCES courses(id),
      FOREIGN KEY (uploaderId) REFERENCES users(id)
    )
  `);

  database.run(`
    CREATE TABLE lecture_note_ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      noteId INTEGER NOT NULL,
      userId INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      comment TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (noteId) REFERENCES lecture_notes(id),
      FOREIGN KEY (userId) REFERENCES users(id),
      UNIQUE(noteId, userId)
    )
  `);

  database.run(`
    CREATE TABLE course_enrollment_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      courseId INTEGER NOT NULL,
      studentId INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (courseId) REFERENCES courses(id),
      FOREIGN KEY (studentId) REFERENCES users(id),
      UNIQUE(courseId, studentId)
    )
  `);

  // Drop old tables
  database.run('DROP TABLE instructors');
  database.run('DROP TABLE students');

  saveDatabase(database);
  console.log('Database migration completed');
}

// Helper function to create or update user with correct password
async function createTestUser(name: string, email: string, password: string, role: 'admin' | 'instructor' | 'student', facultyId: number | null, departmentId: number | null): Promise<number | null> {
  const existing = await dbGet('SELECT id FROM users WHERE email = ?', [email]);
  const hashedPassword = await hashPassword(password);

  if (existing) {
    // Update existing user's password to ensure it matches
    await dbRun('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, email]);
    console.log(`  - Updated test user password: ${email} / ${password}`);
    return existing.id;
  }

  await dbRun('INSERT INTO users (name, email, password, role, facultyId, departmentId, createdAt) VALUES (?, ?, ?, ?, ?, ?, datetime("now"))',
    [name, email, hashedPassword, role, facultyId, departmentId]);
  const result = await dbGet('SELECT last_insert_rowid() as id');
  console.log(`  - Created test user: ${email} / ${password}`);
  return result?.id || null;
}

// Seed data
export async function seedDatabase(): Promise<void> {
  const userCount = await dbGet('SELECT COUNT(*) as count FROM users');

  if (userCount && userCount.count === 0) {
    console.log('Seeding database with initial data...');
  } else {
    console.log('Ensuring test accounts exist...');
  }

  // Insert or get Faculties
  const faculties = [
    'Bilgisayar Bilişim Fakültesi',
    'Havacılık ve Uzay Fakültesi',
    'İktisadi, İdari ve Sosyal Bilimler Fakültesi',
    'Mimarlık ve Tasarım Fakültesi',
    'Mühendislik Fakültesi'
  ];

  const facultyIds: Record<string, number> = {};
  for (const faculty of faculties) {
    const existing = await dbGet('SELECT id FROM faculties WHERE name = ?', [faculty]);
    if (existing) {
      facultyIds[faculty] = existing.id;
    } else {
      const result = await dbRun('INSERT INTO faculties (name, createdAt) VALUES (?, datetime("now"))', [faculty]);
      facultyIds[faculty] = result.lastInsertRowid;
    }
  }

  // Insert or get Departments
  const departmentsMap: Record<string, string[]> = {
    'Bilgisayar Bilişim Fakültesi': [
      'Bilgisayar Mühendisliği Bölümü',
      'Yazılım Mühendisliği Bölümü',
      'Yapay Zeka Mühendisliği Bölümü',
      'Veri Bilimi ve Analitiği Bölümü',
      'Bilişim Sistemleri ve Teknolojileri Bölümü',
      'Bilgi Güvenliği Teknolojisi Bölümü'
    ],
    'Havacılık ve Uzay Fakültesi': [
      'Havacılık ve Uzay Mühendisliği Bölümü',
      'İklim Bilimi ve Meteoroloji Mühendisliği Bölümü',
      'Havacılık Yönetimi Bölümü',
      'Hava Trafik Kontrolü Bölümü'
    ],
    'İktisadi, İdari ve Sosyal Bilimler Fakültesi': [
      'Yönetim Bilişim Sistemleri Bölümü',
      'Uluslararası Ticaret ve Finansman Bölümü',
      'İşletme Bölümü',
      'Turizm İşletmeciliği Bölümü',
      'Siyaset Bilimi ve Kamu Yönetimi Bölümü',
      'Uluslararası İlişkiler Bölümü',
      'Psikoloji Bölümü',
      'Türk Dili ve Edebiyatı Bölümü',
      'Mütercim ve Tercümanlık Bölümü',
      'Gastronomi ve Mutfak Sanatları Bölümü'
    ],
    'Mimarlık ve Tasarım Fakültesi': [
      'Mimarlık Bölümü',
      'İç Mimarlık Bölümü',
      'Endüstriyel Tasarım Bölümü'
    ],
    'Mühendislik Fakültesi': [
      'Biyomühendislik',
      'Elektrik-Elektronik Mühendisliği',
      'Endüstri Mühendisliği',
      'Enerji Sistemleri Mühendisliği',
      'Gıda Mühendisliği',
      'İnşaat Mühendisliği',
      'Maden Mühendisliği',
      'Makine Mühendisliği',
      'Malzeme Bilimi ve Mühendisliği'
    ]
  };

  const departmentIds: Record<string, number> = {};
  for (const [faculty, departments] of Object.entries(departmentsMap)) {
    const facultyId = facultyIds[faculty];
    for (const dept of departments) {
      const existing = await dbGet('SELECT id FROM departments WHERE name = ? AND facultyId = ?', [dept, facultyId]);
      if (existing) {
        departmentIds[dept] = existing.id;
      } else {
        const result = await dbRun('INSERT INTO departments (name, facultyId, createdAt) VALUES (?, ?, datetime("now"))', [dept, facultyId]);
        departmentIds[dept] = result.lastInsertRowid;
      }
    }
  }

  // Create admin user
  const adminId = await createTestUser('System Admin', 'admin@atu.edu.tr', 'admin123', 'admin', null, null) || 1;

  // Create instructors for different departments
  // Software Engineering instructor
  const swInstructorId = await createTestUser(
    'Dr. Ahmet Yılmaz',
    'ahmet.yilmaz@atu.edu.tr',
    'instructor123',
    'instructor',
    facultyIds['Bilgisayar Bilişim Fakültesi'],
    departmentIds['Yazılım Mühendisliği Bölümü']
  ) || 2;

  // Management Information Systems instructor
  const misInstructorId = await createTestUser(
    'Dr. Ayşe Demir',
    'ayse.demir@atu.edu.tr',
    'instructor123',
    'instructor',
    facultyIds['İktisadi, İdari ve Sosyal Bilimler Fakültesi'],
    departmentIds['Yönetim Bilişim Sistemleri Bölümü']
  ) || 3;

  // Additional generic test instructor
  const testInstructorId = await createTestUser(
    'Test Instructor',
    'instructor@atu.edu.tr',
    'instructor123',
    'instructor',
    facultyIds['Bilgisayar Bilişim Fakültesi'],
    departmentIds['Yazılım Mühendisliği Bölümü']
  ) || 4;

  // Create students
  const student1Id = await createTestUser(
    'Mehmet Kaya',
    'mehmet.kaya@ogr.atu.edu.tr',
    'student123',
    'student',
    facultyIds['Bilgisayar Bilişim Fakültesi'],
    departmentIds['Yazılım Mühendisliği Bölümü']
  ) || 4;

  const student2Id = await createTestUser(
    'Fatma Çelik',
    'fatma.celik@ogr.atu.edu.tr',
    'student123',
    'student',
    facultyIds['Bilgisayar Bilişim Fakültesi'],
    departmentIds['Yazılım Mühendisliği Bölümü']
  ) || 5;

  const student3Id = await createTestUser(
    'Ali Yıldız',
    'ali.yildiz@ogr.atu.edu.tr',
    'student123',
    'student',
    facultyIds['İktisadi, İdari ve Sosyal Bilimler Fakültesi'],
    departmentIds['Yönetim Bilişim Sistemleri Bölümü']
  ) || 6;

  // Additional generic test student
  const student4Id = await createTestUser(
    'Test Student',
    'student@ogr.atu.edu.tr',
    'student123',
    'student',
    facultyIds['Bilgisayar Bilişim Fakültesi'],
    departmentIds['Yazılım Mühendisliği Bölümü']
  ) || 7;

  // Create courses if they don't exist
  async function getOrCreateCourse(title: string, instructorId: number, facultyId: number, departmentId: number): Promise<number> {
    const existing = await dbGet('SELECT id FROM courses WHERE title = ? AND instructorId = ?', [title, instructorId]);
    if (existing) {
      return existing.id;
    }
    const result = await dbRun('INSERT INTO courses (title, instructorId, facultyId, departmentId) VALUES (?, ?, ?, ?)',
      [title, instructorId, facultyId, departmentId]);
    return result.lastInsertRowid;
  }

  const course1Id = await getOrCreateCourse('Yazılım Mühendisliği', swInstructorId, facultyIds['Bilgisayar Bilişim Fakültesi'], departmentIds['Yazılım Mühendisliği Bölümü']);
  const course2Id = await getOrCreateCourse('Veri Yapıları', swInstructorId, facultyIds['Bilgisayar Bilişim Fakültesi'], departmentIds['Yazılım Mühendisliği Bölümü']);
  const course3Id = await getOrCreateCourse('İşletme Yönetimi', misInstructorId, facultyIds['İktisadi, İdari ve Sosyal Bilimler Fakültesi'], departmentIds['Yönetim Bilişim Sistemleri Bölümü']);

  // Insert enrollments (if not already enrolled)
  async function enrollStudent(courseId: number, studentId: number): Promise<void> {
    const existing = await dbGet('SELECT * FROM course_enrollments WHERE courseId = ? AND studentId = ?', [courseId, studentId]);
    if (!existing) {
      await dbRun('INSERT INTO course_enrollments (courseId, studentId) VALUES (?, ?)', [courseId, studentId]);
    }
  }

  await enrollStudent(course1Id, student1Id);
  await enrollStudent(course1Id, student2Id);
  await enrollStudent(course2Id, student1Id);
  await enrollStudent(course3Id, student3Id);

  console.log('Database seeded successfully');
  console.log(`  - Admin: admin@atu.edu.tr / admin123 (ID: ${adminId})`);
  console.log(`  - Instructors: ahmet.yilmaz@atu.edu.tr, ayse.demir@atu.edu.tr, instructor@atu.edu.tr / instructor123`);
  console.log(`  - Students: mehmet.kaya@ogr.atu.edu.tr, fatma.celik@ogr.atu.edu.tr, ali.yildiz@ogr.atu.edu.tr, student@ogr.atu.edu.tr / student123`);
  console.log(`  - Faculties: ${faculties.length} faculties`);
  console.log(`  - Departments: ${Object.values(departmentsMap).flat().length} departments`);
  console.log(`  - Courses: ${course1Id} (Yazılım Mühendisliği), ${course2Id} (Veri Yapıları), ${course3Id} (İşletme Yönetimi)`);
}

// Close database
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
