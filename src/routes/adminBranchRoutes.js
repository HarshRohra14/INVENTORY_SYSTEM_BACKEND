const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');

// Controller placeholders (implement in controllers/adminBranchController.js)
const {
  listBranches,
  getBranchById,
  createBranch,
  updateBranch,
  deactivateBranch
} = require('../controllers/adminBranchController');

// All admin routes require auth + admin role
router.use(authMiddleware, requireAdmin);

// CRUD endpoints
router.get('/', listBranches);
router.get('/:id', getBranchById);
router.post('/', createBranch);
router.put('/:id', updateBranch);
router.delete('/:id', deactivateBranch);
// Hard delete branch
const { deleteBranch } = require('../controllers/adminBranchController');
router.delete('/:id/hard', deleteBranch);

module.exports = router;


