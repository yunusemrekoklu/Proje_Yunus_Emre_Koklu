import express from 'express';
import { dbAll, dbGet, dbRun } from '../db/schema';

const router = express.Router();

// GET /api/departments - Get all departments
router.get('/', async (req, res) => {
  try {
    const { facultyId } = req.query;

    let query = `
      SELECT d.id, d.name, d.facultyId, d.createdAt,
             f.name as facultyName
      FROM departments d
      LEFT JOIN faculties f ON d.facultyId = f.id
    `;

    const params: any[] = [];

    if (facultyId) {
      query += ' WHERE d.facultyId = ?';
      params.push(Number(facultyId));
    }

    query += ' ORDER BY f.name, d.name';

    const departments = await dbAll(query, params);

    res.json({
      success: true,
      data: departments
    });
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch departments'
    });
  }
});

// GET /api/departments/:id - Get department by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const department = await dbGet(`
      SELECT d.id, d.name, d.facultyId, d.createdAt,
             f.name as facultyName
      FROM departments d
      LEFT JOIN faculties f ON d.facultyId = f.id
      WHERE d.id = ?
    `, [Number(id)]);

    if (!department) {
      return res.status(404).json({
        success: false,
        error: 'Department not found'
      });
    }

    res.json({
      success: true,
      data: department
    });
  } catch (error) {
    console.error('Error fetching department:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch department'
    });
  }
});

// POST /api/departments - Create new department (admin only)
router.post('/', async (req, res) => {
  const { name, facultyId } = req.body;

  if (!name || !facultyId) {
    return res.status(400).json({
      success: false,
      error: 'Department name and facultyId are required'
    });
  }

  try {
    const result = await dbRun(
      'INSERT INTO departments (name, facultyId, createdAt) VALUES (?, ?, datetime("now"))',
      [name, Number(facultyId)]
    );

    const department = await dbGet(`
      SELECT d.id, d.name, d.facultyId, d.createdAt,
             f.name as facultyName
      FROM departments d
      LEFT JOIN faculties f ON d.facultyId = f.id
      WHERE d.id = ?
    `, [result.lastInsertRowid]);

    res.status(201).json({
      success: true,
      data: department,
      message: 'Department created successfully'
    });
  } catch (error) {
    console.error('Error creating department:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create department'
    });
  }
});

// PUT /api/departments/:id - Update department (admin only)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, facultyId } = req.body;

  if (!name || !facultyId) {
    return res.status(400).json({
      success: false,
      error: 'Department name and facultyId are required'
    });
  }

  try {
    await dbRun(
      'UPDATE departments SET name = ?, facultyId = ? WHERE id = ?',
      [name, Number(facultyId), Number(id)]
    );

    const department = await dbGet(`
      SELECT d.id, d.name, d.facultyId, d.createdAt,
             f.name as facultyName
      FROM departments d
      LEFT JOIN faculties f ON d.facultyId = f.id
      WHERE d.id = ?
    `, [Number(id)]);

    if (!department) {
      return res.status(404).json({
        success: false,
        error: 'Department not found'
      });
    }

    res.json({
      success: true,
      data: department,
      message: 'Department updated successfully'
    });
  } catch (error) {
    console.error('Error updating department:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update department'
    });
  }
});

// DELETE /api/departments/:id - Delete department (admin only)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await dbRun('DELETE FROM departments WHERE id = ?', [Number(id)]);

    res.json({
      success: true,
      message: 'Department deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting department:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete department'
    });
  }
});

export default router;
