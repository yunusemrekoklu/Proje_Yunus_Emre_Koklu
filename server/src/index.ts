import express from 'express';
import cors from 'cors';
import session from 'express-session';
import path from 'path';
import { config } from './config';
import { initializeDatabase, seedDatabase, closeDatabase } from './db/schema';
import { cleanupTempFiles } from './services/fileUpload';
import healthRoutes from './routes/health';
import coursesRoutes from './routes/courses';
import materialsRoutes from './routes/materials';
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import ratingsRoutes from './routes/ratings';
import gradesRoutes from './routes/grades';
import lectureNotesRoutes from './routes/lectureNotes';
import facultiesRoutes from './routes/faculties';
import departmentsRoutes from './routes/departments';
import enrollmentsRoutes from './routes/enrollments';

const app = express();
const PORT = config.port;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'instructor-material-upload-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true if using HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Serve static files from client directory
app.use(express.static(path.join(process.cwd(), 'client')));

// API Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/faculties', facultiesRoutes);
app.use('/api/departments', departmentsRoutes);
app.use('/api/enrollments', enrollmentsRoutes);
app.use('/api', ratingsRoutes);
app.use('/api', gradesRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api', materialsRoutes);
app.use('/api', lectureNotesRoutes);

// SPA fallback - serve index.html for non-API routes
app.get('*', (req, res) => {
  // Only redirect non-API routes to index
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(process.cwd(), 'client', 'index.html'));
  } else {
    res.status(404).json({
      success: false,
      error: 'API endpoint not found'
    });
  }
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Initialize and start server
async function startServer() {
  try {
    // Initialize database
    console.log('Initializing database...');
    await initializeDatabase();
    await seedDatabase();

    // Cleanup temp files on startup
    cleanupTempFiles();

    // Start server
    app.listen(PORT, () => {
      console.log(`\n========================================`);
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`========================================\n`);

      // Health check on startup
      setTimeout(async () => {
        try {
          const response = await fetch(`http://localhost:${PORT}/api/health`);
          const data = await response.json();
          console.log(`HEALTH OK:`, data);
        } catch (err) {
          console.log('Health check failed (this is normal on first start)');
        }
      }, 1000);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down server...');
  closeDatabase();
  process.exit(0);
});

startServer();
