const Joi = require('joi');
const prisma = require('../lib/prisma'); // reuse shared prisma client

const listManagers = async (req, res) => {
  try {
    const managers = await prisma.user.findMany({ where: { role: 'MANAGER', isActive: true }, select: { id: true, firstName: true, lastName: true, email: true } });
    res.json({ success: true, data: managers });
  } catch (error) {
    console.error('List managers error:', error);
    res.status(500).json({ success: false, message: 'Failed to list managers' });
  }
};

const listBranches = async (req, res) => {
  try {
    const branches = await prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true } });
    res.json({ success: true, data: branches });
  } catch (error) {
    console.error('List branches error:', error);
    res.status(500).json({ success: false, message: 'Failed to list branches' });
  }
};

const getAssignmentsByManager = async (req, res) => {
  try {
    const managerId = req.params.managerId;
    const assignments = await prisma.managerBranch.findMany({ where: { managerId, isActive: true }, select: { branchId: true } });
    res.json({ success: true, data: assignments.map(a => a.branchId) });
  } catch (error) {
    console.error('Get assignments error:', error);
    res.status(500).json({ success: false, message: 'Failed to get assignments' });
  }
};
const assignBranchesToManager = async (req, res) => {
  try {
    const schema = Joi.object({ branchIds: Joi.array().items(Joi.string()).min(1).required() });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.message });
    const { branchIds } = value;
    const managerId = req.params.managerId;

    // Upsert assignments
    await prisma.$transaction(async (tx) => {
      for (const branchId of branchIds) {
        await tx.managerBranch.upsert({
          where: { managerId_branchId: { managerId, branchId } },
          update: { isActive: true },
          create: { managerId, branchId, isActive: true }
        });
      }
    });

    res.json({ success: true, message: 'Assignments updated' });
  } catch (error) {
    console.error('Assign branches error:', error);
    res.status(500).json({ success: false, message: 'Failed to assign branches' });
  }
};

const unassignBranchesFromManager = async (req, res) => {
  try {
    const schema = Joi.object({ branchIds: Joi.array().items(Joi.string()).min(1).required() });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.message });
    const { branchIds } = value;
    const managerId = req.params.managerId;

    await prisma.managerBranch.updateMany({ where: { managerId, branchId: { in: branchIds } }, data: { isActive: false } });
    res.json({ success: true, message: 'Assignments removed' });
  } catch (error) {
    console.error('Unassign branches error:', error);
    res.status(500).json({ success: false, message: 'Failed to unassign branches' });
  }
};

module.exports = {
  listManagers,
  listBranches,
  getAssignmentsByManager,
  assignBranchesToManager,
  unassignBranchesFromManager
};


