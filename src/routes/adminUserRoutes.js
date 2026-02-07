const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');

// Controller placeholders (implement in controllers/adminUserController.js)
const {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deactivateUser,
  deleteUser,
  resetUserPassword
} = require('../controllers/adminUserController');

// All admin routes require auth + admin role
router.use(authMiddleware, requireAdmin);

// CRUD endpoints
router.get('/', listUsers);
router.get('/:id', getUserById);
router.post('/', createUser);
router.put('/:id', updateUser);
router.put('/:id/reset-password', resetUserPassword);
router.delete('/:id', deactivateUser);
router.delete('/:id/hard', deleteUser);

module.exports = router;


