import express from 'express';
import { dbAll, dbGet, dbRun } from '../db/schema';
import { requireAuth } from '../middleware/auth';

const router = express.Router();

// GET /api/materials/:materialId/grades - Get all grades for a material
router.get('/materials/:materialId/grades', async (req, res) => {
  const { materialId } = req.params;

  try {
    const grades = await dbAll(`
      SELECT g.id, g.materialId, g.grade, g.createdAt,
             u.id as userId, u.name as userName, u.role as userRole
      FROM material_grades g
      JOIN users u ON g.userId = u.id
      WHERE g.materialId = ?
      ORDER BY g.createdAt DESC
    `, [Number(materialId)]);

    // Calculate average
    const avgResult = await dbGet(
      'SELECT AVG(grade) as average, COUNT(*) as count FROM material_grades WHERE materialId = ?',
      [Number(materialId)]
    );

    res.json({
      success: true,
      data: {
        grades,
        average: avgResult?.average || 0,
        count: avgResult?.count || 0
      }
    });
  } catch (error) {
    console.error('Error fetching grades:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch grades'
    });
  }
});

// POST /api/materials/:materialId/grades - Add/update grade
router.post('/materials/:materialId/grades', requireAuth, async (req, res) => {
  const { materialId } = req.params;
  const { grade } = req.body;
  const userId = req.session.user!.id;

  if (grade === undefined || grade === null || grade < 0 || grade > 100) {
    return res.status(400).json({
      success: false,
      error: 'Grade must be between 0 and 100'
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

    // Check if user already graded
    const existing = await dbGet(
      'SELECT id FROM material_grades WHERE materialId = ? AND userId = ?',
      [Number(materialId), userId]
    );

    if (existing) {
      // Update existing grade
      await dbRun(
        'UPDATE material_grades SET grade = ?, createdAt = datetime("now") WHERE materialId = ? AND userId = ?',
        [grade, Number(materialId), userId]
      );
    } else {
      // Insert new grade
      await dbRun(
        'INSERT INTO material_grades (materialId, userId, grade, createdAt) VALUES (?, ?, ?, datetime("now"))',
        [Number(materialId), userId, grade]
      );
    }

    // Get updated grades
    const grades = await dbAll(`
      SELECT g.id, g.materialId, g.grade, g.createdAt,
             u.id as userId, u.name as userName, u.role as userRole
      FROM material_grades g
      JOIN users u ON g.userId = u.id
      WHERE g.materialId = ?
      ORDER BY g.createdAt DESC
    `, [Number(materialId)]);

    const avgResult = await dbGet(
      'SELECT AVG(grade) as average, COUNT(*) as count FROM material_grades WHERE materialId = ?',
      [Number(materialId)]
    );

    res.json({
      success: true,
      message: existing ? 'Grade updated successfully' : 'Grade added successfully',
      data: {
        grades,
        average: avgResult?.average || 0,
        count: avgResult?.count || 0
      }
    });
  } catch (error) {
    console.error('Error saving grade:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save grade'
    });
  }
});

// DELETE /api/materials/:materialId/grades - Delete own grade
router.delete('/materials/:materialId/grades', requireAuth, async (req, res) => {
  const { materialId } = req.params;
  const userId = req.session.user!.id;

  try {
    const existing = await dbGet(
      'SELECT id FROM material_grades WHERE materialId = ? AND userId = ?',
      [Number(materialId), userId]
    );

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Grade not found'
      });
    }

    await dbRun(
      'DELETE FROM material_grades WHERE materialId = ? AND userId = ?',
      [Number(materialId), userId]
    );

    res.json({
      success: true,
      message: 'Grade deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting grade:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete grade'
    });
  }
});

export default router;
