const express = require('express');
const router = express.Router();

// Import middleware
const authMiddleware = require('../middleware/authMiddleware');

// Import services
const { getManagerBranches } = require('../services/managerBranchService');

/**
 * Branch Routes
 * 
 * GET /api/branches/manager - Get branches assigned to current manager
 */

// All routes require authentication
router.use(authMiddleware);

/**
 * Get branches for current manager
 * GET /api/branches/manager
 */
router.get('/manager', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await getManagerBranches(userId);

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('Get manager branches error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching manager branches.'
    });
  }
});

/**
 * Get target locations for current user's branch
 * GET /api/branches/me/target-locations
 */
router.get('/me/target-locations', async (req, res) => {
  try {
    const branchId = req.user?.branchId;
    if (!branchId) {
      return res.json({ success: true, data: [] });
    }
    const prisma = require('../lib/prisma');
    const locations = await prisma.branchTargetLocation.findMany({
      where: { branchId },
      select: { location: true }
    });
    // Also merge CSV snapshot from branches.targetLocation if present
    const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { targetLocation: true } });
    const list = locations.map(l => l.location);
    if (branch?.targetLocation) {
      const csv = String(branch.targetLocation)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      for (const loc of csv) {
        if (!list.includes(loc)) list.push(loc);
      }
    }
    res.json({ success: true, data: list });
  } catch (error) {
    console.error('Get my branch target locations error:', error);
    res.status(500).json({ success: false, message: 'Internal server error while fetching target locations.' });
  }
});

/**
 * Get target locations for a specific branch (by branchId)
 * GET /api/branches/:branchId/target-locations
 */
router.get('/:branchId/target-locations', async (req, res) => {
  try {
    const { branchId } = req.params;
    const prisma = require('../lib/prisma');

    const locations = await prisma.branchTargetLocation.findMany({
      where: { branchId },
      select: { location: true }
    });

    res.json({ success: true, data: locations.map(l => l.location) });
  } catch (error) {
    console.error('Get branch target locations error:', error);
    res.status(500).json({ success: false, message: 'Internal server error while fetching branch target locations.' });
  }
});

module.exports = router;

