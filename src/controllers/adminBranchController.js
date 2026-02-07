const Joi = require('joi');
const prisma = require('../lib/prisma'); // reuse shared prisma client

const listBranches = async (req, res) => {
  try {
    const branches = await prisma.branch.findMany({
      orderBy: { createdAt: 'desc' },
      include: { targetLocations: true }
    });
    res.json({ success: true, data: branches });
  } catch (error) {
    console.error('List branches error:', error);
    res.status(500).json({ success: false, message: 'Failed to list branches' });
  }
};

const getBranchById = async (req, res) => {
  try {
    const branch = await prisma.branch.findUnique({
      where: { id: req.params.id },
      include: { targetLocations: true }
    });
    if (!branch) return res.status(404).json({ success: false, message: 'Branch not found' });
    res.json({ success: true, data: branch });
  } catch (error) {
    console.error('Get branch error:', error);
    res.status(500).json({ success: false, message: 'Failed to get branch' });
  }
};

const createBranch = async (req, res) => {
  try {
    const schema = Joi.object({
      name: Joi.string().required(),
      address: Joi.string().required(),
      city: Joi.string().required(),
      state: Joi.string().required(),
      zipCode: Joi.string().required(),
      phone: Joi.string().allow('', null),
      email: Joi.string().email().allow('', null),
      targetLocations: Joi.array().items(Joi.string()).default([])
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.message });

    const { targetLocations, ...branchData } = value;
    // Persist CSV snapshot too for resilience
    const branch = await prisma.branch.create({ data: { ...branchData, targetLocation: (targetLocations || []).join(',') || null } });

    if (targetLocations && targetLocations.length > 0) {
      await prisma.branchTargetLocation.createMany({
        data: targetLocations.map((location) => ({ branchId: branch.id, location }))
      });
    }

    const full = await prisma.branch.findUnique({ where: { id: branch.id }, include: { targetLocations: true } });
    res.status(201).json({ success: true, data: full });
  } catch (error) {
    console.error('Create branch error:', error);
    res.status(500).json({ success: false, message: 'Failed to create branch' });
  }
};

const updateBranch = async (req, res) => {
  try {
    const schema = Joi.object({
      name: Joi.string().optional(),
      address: Joi.string().optional(),
      city: Joi.string().optional(),
      state: Joi.string().optional(),
      zipCode: Joi.string().optional(),
      phone: Joi.string().allow('', null),
      email: Joi.string().email().allow('', null),
      targetLocations: Joi.array().items(Joi.string()).optional()
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.message });

    const { targetLocations, ...branchData } = value;
    await prisma.branch.update({ where: { id: req.params.id }, data: { ...branchData, targetLocation: Array.isArray(targetLocations) ? (targetLocations.join(',') || null) : undefined } });

    if (Array.isArray(targetLocations)) {
      await prisma.branchTargetLocation.deleteMany({ where: { branchId: req.params.id } });
      if (targetLocations.length > 0) {
        await prisma.branchTargetLocation.createMany({
          data: targetLocations.map((location) => ({ branchId: req.params.id, location }))
        });
      }
    }

    const full = await prisma.branch.findUnique({ where: { id: req.params.id }, include: { targetLocations: true } });
    res.json({ success: true, data: full });
  } catch (error) {
    console.error('Update branch error:', error);
    res.status(500).json({ success: false, message: 'Failed to update branch' });
  }
};

const deactivateBranch = async (req, res) => {
  try {
    const branch = await prisma.branch.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ success: true, data: branch });
  } catch (error) {
    console.error('Deactivate branch error:', error);
    res.status(500).json({ success: false, message: 'Failed to deactivate branch' });
  }
};

const deleteBranch = async (req, res) => {
  try {
    await prisma.branch.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Branch deleted' });
  } catch (error) {
    console.error('Delete branch error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Branch not found' });
    }
    res.status(500).json({ success: false, message: 'Failed to delete branch' });
  }
};

module.exports = {
  listBranches,
  getBranchById,
  createBranch,
  updateBranch,
  deactivateBranch,
  deleteBranch
};


