const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');

const {
  listUsersByRole,
  listBranches,
  getAssignmentsByUser,
  assignBranchesToUser,
  unassignBranchesFromUser
} = require('../controllers/adminStaffAssignmentController');

// All admin routes require auth + admin role
router.use(authMiddleware, requireAdmin);

// Role should be 'PACKAGER' or 'DISPATCHER'
router.get('/users/:role', listUsersByRole);
router.get('/branches', listBranches);
router.get('/user/:userId', getAssignmentsByUser);
router.post('/user/:userId/assign', assignBranchesToUser);
router.post('/user/:userId/unassign', unassignBranchesFromUser);

module.exports = router;
