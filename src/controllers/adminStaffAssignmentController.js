const { PrismaClient } = require('@prisma/client');
const Joi = require('joi');
const prisma = require('../lib/prisma'); // reuse shared prisma client

// List users by role (PACKAGER or DISPATCHER)
const listUsersByRole = async (req, res) => {
  try {
    const role = req.params.role;
    if (!['PACKAGER', 'DISPATCHER'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }
    const users = await prisma.user.findMany({ where: { role, isActive: true }, select: { id: true, firstName: true, lastName: true, email: true } });
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('List users by role error:', error);
    res.status(500).json({ success: false, message: 'Failed to list users' });
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

const getAssignmentsByUser = async (req, res) => {
  try {
    const userId = req.params.userId;
    const assignments = await prisma.userBranchAssignment.findMany({ where: { userId, isActive: true }, select: { branchId: true } });
    res.json({ success: true, data: assignments.map(a => a.branchId) });
  } catch (error) {
    console.error('Get user assignments error:', error);
    res.status(500).json({ success: false, message: 'Failed to get assignments' });
  }
};

const assignBranchesToUser = async (req, res) => {
  try {
    const schema = Joi.object({ branchIds: Joi.array().items(Joi.string()).min(1).required() });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.message });
    const { branchIds } = value;
    const userId = req.params.userId;

    // Upsert assignments
    await prisma.$transaction(async (tx) => {
      for (const branchId of branchIds) {
        await tx.userBranchAssignment.upsert({
          where: { userId_branchId: { userId, branchId } },
          update: { isActive: true },
          create: { userId, branchId, isActive: true }
        });
      }
    });

    res.json({ success: true, message: 'Assignments updated' });
  } catch (error) {
    console.error('Assign branches to user error:', error);
    res.status(500).json({ success: false, message: 'Failed to assign branches' });
  }
};

const unassignBranchesFromUser = async (req, res) => {
  try {
    const schema = Joi.object({ branchIds: Joi.array().items(Joi.string()).min(1).required() });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.message });
    const { branchIds } = value;
    const userId = req.params.userId;

    await prisma.userBranchAssignment.updateMany({ where: { userId, branchId: { in: branchIds } }, data: { isActive: false } });
    res.json({ success: true, message: 'Assignments removed' });
  } catch (error) {
    console.error('Unassign branches from user error:', error);
    res.status(500).json({ success: false, message: 'Failed to unassign branches' });
  }
};

module.exports = {
  listUsersByRole,
  listBranches,
  getAssignmentsByUser,
  assignBranchesToUser,
  unassignBranchesFromUser
};
