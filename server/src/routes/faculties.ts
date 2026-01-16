import express from 'express';
import { dbAll, dbGet, dbRun } from '../db/schema';

const router = express.Router();

// GET /api/faculties - Get all faculties
router.get('/', async (req, res) => {
  try {
    const faculties = await dbAll(`
      SELECT id, name, createdAt
      FROM faculties
      ORDER BY name
    `);

    res.json({
      success: true,
      data: faculties
    });
  } catch (error) {
    console.error('Error fetching faculties:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch faculties'
    });
  }
});

// GET /api/faculties/:id - Get faculty by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const faculty = await dbGet(
      'SELECT id, name, createdAt FROM faculties WHERE id = ?',
      [Number(id)]
    );

    if (!faculty) {
      return res.status(404).json({
        success: false,
        error: 'Faculty not found'
      });
    }

    // Get departments for this faculty
    const departments = await dbAll(`
      SELECT id, name, facultyId, createdAt
      FROM departments
      WHERE facultyId = ?
      ORDER BY name
    `, [Number(id)]);

    res.json({
      success: true,
      data: {
        ...faculty,
        departments
      }
    });
  } catch (error) {
    console.error('Error fetching faculty:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch faculty'
    });
  }
});

// POST /api/faculties - Create new faculty (admin only)
router.post('/', async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({
      success: false,
      error: 'Faculty name is required'
    });
  }

  try {
    const result = await dbRun(
      'INSERT INTO faculties (name, createdAt) VALUES (?, datetime("now"))',
      [name]
    );

    const faculty = await dbGet(
      'SELECT id, name, createdAt FROM faculties WHERE id = ?',
      [result.lastInsertRowid]
    );

    res.status(201).json({
      success: true,
      data: faculty,
      message: 'Faculty created successfully'
    });
  } catch (error) {
    console.error('Error creating faculty:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create faculty'
    });
  }
});

// PUT /api/faculties/:id - Update faculty (admin only)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({
      success: false,
      error: 'Faculty name is required'
    });
  }

  try {
    await dbRun(
      'UPDATE faculties SET name = ? WHERE id = ?',
      [name, Number(id)]
    );

    const faculty = await dbGet(
      'SELECT id, name, createdAt FROM faculties WHERE id = ?',
      [Number(id)]
    );

    if (!faculty) {
      return res.status(404).json({
        success: false,
        error: 'Faculty not found'
      });
    }

    res.json({
      success: true,
      data: faculty,
      message: 'Faculty updated successfully'
    });
  } catch (error) {
    console.error('Error updating faculty:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update faculty'
    });
  }
});

// DELETE /api/faculties/:id - Delete faculty (admin only)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await dbRun('DELETE FROM faculties WHERE id = ?', [Number(id)]);

    res.json({
      success: true,
      message: 'Faculty deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting faculty:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete faculty'
    });
  }
});

export default router;
