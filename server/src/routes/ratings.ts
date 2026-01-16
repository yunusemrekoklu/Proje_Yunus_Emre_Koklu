import express from 'express';
import { dbAll, dbGet, dbRun } from '../db/schema';
import { requireAuth } from '../middleware/auth';

const router = express.Router();

// GET /api/materials/:materialId/ratings - Get all ratings for a material
router.get('/materials/:materialId/ratings', async (req, res) => {
  const { materialId } = req.params;

  try {
    const ratings = await dbAll(`
      SELECT r.id, r.materialId, r.rating, r.comment, r.createdAt,
             u.id as userId, u.name as userName, u.role as userRole
      FROM material_ratings r
      JOIN users u ON r.userId = u.id
      WHERE r.materialId = ?
      ORDER BY r.createdAt DESC
    `, [Number(materialId)]);

    // Calculate average
    const avgResult = await dbGet(
      'SELECT AVG(rating) as average, COUNT(*) as count FROM material_ratings WHERE materialId = ?',
      [Number(materialId)]
    );

    res.json({
      success: true,
      data: {
        ratings,
        average: avgResult?.average || 0,
        count: avgResult?.count || 0
      }
    });
  } catch (error) {
    console.error('Error fetching ratings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ratings'
    });
  }
});

// POST /api/materials/:materialId/ratings - Add/update rating
router.post('/materials/:materialId/ratings', requireAuth, async (req, res) => {
  const { materialId } = req.params;
  const { rating, comment } = req.body;
  const userId = req.session.user!.id;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({
      success: false,
      error: 'Rating must be between 1 and 5'
    });
  }

  try {
    // Check if material exists
    const material = await dbGet('SELECT id FROM materials WHERE id = ?', [Number(materialId)]);
    if (!material) {
      return res.status(404).json({
        success: false,
        error: 'Material not found'
      });
    }

    // Check if user already rated
    const existing = await dbGet(
      'SELECT id FROM material_ratings WHERE materialId = ? AND userId = ?',
      [Number(materialId), userId]
    );

    if (existing) {
      // Update existing rating
      await dbRun(
        'UPDATE material_ratings SET rating = ?, comment = ?, createdAt = datetime("now") WHERE materialId = ? AND userId = ?',
        [rating, comment || '', Number(materialId), userId]
      );
    } else {
      // Insert new rating
      await dbRun(
        'INSERT INTO material_ratings (materialId, userId, rating, comment, createdAt) VALUES (?, ?, ?, ?, datetime("now"))',
        [Number(materialId), userId, rating, comment || '']
      );
    }

    // Get updated ratings
    const ratings = await dbAll(`
      SELECT r.id, r.materialId, r.rating, r.comment, r.createdAt,
             u.id as userId, u.name as userName, u.role as userRole
      FROM material_ratings r
      JOIN users u ON r.userId = u.id
      WHERE r.materialId = ?
      ORDER BY r.createdAt DESC
    `, [Number(materialId)]);

    const avgResult = await dbGet(
      'SELECT AVG(rating) as average, COUNT(*) as count FROM material_ratings WHERE materialId = ?',
      [Number(materialId)]
    );

    res.json({
      success: true,
      message: existing ? 'Rating updated successfully' : 'Rating added successfully',
      data: {
        ratings,
        average: avgResult?.average || 0,
        count: avgResult?.count || 0
      }
    });
  } catch (error) {
    console.error('Error saving rating:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save rating'
    });
  }
});

// DELETE /api/materials/:materialId/ratings - Delete own rating
router.delete('/materials/:materialId/ratings', requireAuth, async (req, res) => {
  const { materialId } = req.params;
  const userId = req.session.user!.id;

  try {
    const existing = await dbGet(
      'SELECT id FROM material_ratings WHERE materialId = ? AND userId = ?',
      [Number(materialId), userId]
    );

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Rating not found'
      });
    }

    await dbRun(
      'DELETE FROM material_ratings WHERE materialId = ? AND userId = ?',
      [Number(materialId), userId]
    );

    res.json({
      success: true,
      message: 'Rating deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting rating:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete rating'
    });
  }
});

// ============================================
// Lecture Notes Ratings (parallel structure to material ratings)
// ============================================

// GET /api/notes/:noteId/ratings
router.get('/notes/:noteId/ratings', async (req, res) => {
  const { noteId } = req.params;

  try {
    const ratings = await dbAll(`
      SELECT r.id, r.noteId, r.rating, r.comment, r.createdAt,
             u.id as userId, u.name as userName, u.role as userRole
      FROM lecture_note_ratings r
      JOIN users u ON r.userId = u.id
      WHERE r.noteId = ?
      ORDER BY r.createdAt DESC
    `, [Number(noteId)]);

    const avgResult = await dbGet(
      'SELECT AVG(rating) as average, COUNT(*) as count FROM lecture_note_ratings WHERE noteId = ?',
      [Number(noteId)]
    );

    res.json({
      success: true,
      data: {
        ratings,
        average: avgResult?.average || 0,
        count: avgResult?.count || 0
      }
    });
  } catch (error) {
    console.error('Error fetching note ratings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ratings'
    });
  }
});

// POST /api/notes/:noteId/ratings
router.post('/notes/:noteId/ratings', requireAuth, async (req, res) => {
  const { noteId } = req.params;
  const { rating, comment } = req.body;
  const userId = req.session.user!.id;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({
      success: false,
      error: 'Rating must be between 1 and 5'
    });
  }

  try {
    // Check if note exists
    const note = await dbGet('SELECT id FROM lecture_notes WHERE id = ?', [Number(noteId)]);
    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Lecture note not found'
      });
    }

    // Check if user already rated
    const existing = await dbGet(
      'SELECT id FROM lecture_note_ratings WHERE noteId = ? AND userId = ?',
      [Number(noteId), userId]
    );

    if (existing) {
      // Update existing rating
      await dbRun(
        'UPDATE lecture_note_ratings SET rating = ?, comment = ?, createdAt = datetime("now") WHERE noteId = ? AND userId = ?',
        [rating, comment || '', Number(noteId), userId]
      );
    } else {
      // Insert new rating
      await dbRun(
        'INSERT INTO lecture_note_ratings (noteId, userId, rating, comment, createdAt) VALUES (?, ?, ?, ?, datetime("now"))',
        [Number(noteId), userId, rating, comment || '']
      );
    }

    // Get updated ratings
    const ratings = await dbAll(`
      SELECT r.id, r.noteId, r.rating, r.comment, r.createdAt,
             u.id as userId, u.name as userName, u.role as userRole
      FROM lecture_note_ratings r
      JOIN users u ON r.userId = u.id
      WHERE r.noteId = ?
      ORDER BY r.createdAt DESC
    `, [Number(noteId)]);

    const avgResult = await dbGet(
      'SELECT AVG(rating) as average, COUNT(*) as count FROM lecture_note_ratings WHERE noteId = ?',
      [Number(noteId)]
    );

    res.json({
      success: true,
      message: existing ? 'Rating updated successfully' : 'Rating added successfully',
      data: {
        ratings,
        average: avgResult?.average || 0,
        count: avgResult?.count || 0
      }
    });
  } catch (error) {
    console.error('Error saving note rating:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save rating'
    });
  }
});

// DELETE /api/notes/:noteId/ratings
router.delete('/notes/:noteId/ratings', requireAuth, async (req, res) => {
  const { noteId } = req.params;
  const userId = req.session.user!.id;

  try {
    const existing = await dbGet(
      'SELECT id FROM lecture_note_ratings WHERE noteId = ? AND userId = ?',
      [Number(noteId), userId]
    );

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Rating not found'
      });
    }

    await dbRun(
      'DELETE FROM lecture_note_ratings WHERE noteId = ? AND userId = ?',
      [Number(noteId), userId]
    );

    res.json({
      success: true,
      message: 'Rating deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting rating:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete rating'
    });
  }
});

export default router;
