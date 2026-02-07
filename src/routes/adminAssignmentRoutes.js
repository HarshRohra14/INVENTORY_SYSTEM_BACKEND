const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');

// Controller placeholders (implement in controllers/adminAssignmentController.js)
const {
  listManagers,
  listBranches,
  getAssignmentsByManager,
  assignBranchesToManager,
  unassignBranchesFromManager
} = require('../controllers/adminAssignmentController');

// All admin routes require auth + admin role
router.use(authMiddleware, requireAdmin);

// Assignment endpoints
router.get('/managers', listManagers);
router.get('/branches', listBranches);
router.get('/manager/:managerId', getAssignmentsByManager);
router.post('/manager/:managerId/assign', assignBranchesToManager);
router.post('/manager/:managerId/unassign', unassignBranchesFromManager);

module.exports = router;


