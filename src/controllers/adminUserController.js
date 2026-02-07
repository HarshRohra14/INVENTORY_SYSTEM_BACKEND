const Joi = require('joi');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma'); // reuse shared prisma client

const listUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, firstName: true, lastName: true, phoneNumber: true, role: true, branchId: true, isActive: true }
    });
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ success: false, message: 'Failed to list users' });
  }
};

const getUserById = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, email: true, firstName: true, lastName: true, phoneNumber: true, role: true, branchId: true, isActive: true }
    });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, message: 'Failed to get user' });
  }
};

const createUser = async (req, res) => {
  try {
    const schema = Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(6).required(),
      firstName: Joi.string().required(),
      lastName: Joi.string().required(),
      // Phone number (E.164 recommended). Allow empty.
      phoneNumber: Joi.string().allow(null, ''),
      // Allow new roles PACKAGER and DISPATCHER
      role: Joi.string().valid('ADMIN', 'MANAGER', 'BRANCH_USER', 'ACCOUNTS', 'PACKAGER', 'DISPATCHER').required(),
      branchId: Joi.string().allow(null, '')
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.message });

  const { email, password, firstName, lastName, phoneNumber, role, branchId } = value;
    // Hash password before saving (match authController salt rounds)
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // For BRANCH_USER, PACKAGER, and DISPATCHER allow assigning a branch
    const assignedBranchId = ['BRANCH_USER', 'PACKAGER', 'DISPATCHER'].includes(role) ? (branchId || null) : null;

    const user = await prisma.user.create({
      data: { email, password: hashedPassword, firstName, lastName, phoneNumber: phoneNumber || null, role, branchId: assignedBranchId }
    });
    res.status(201).json({ success: true, data: { id: user.id } });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ success: false, message: 'Failed to create user' });
  }
};

const updateUser = async (req, res) => {
  try {
    const schema = Joi.object({
      firstName: Joi.string().optional(),
      lastName: Joi.string().optional(),
      phoneNumber: Joi.string().allow(null, ''),
      // Allow updating to PACKAGER and DISPATCHER
      role: Joi.string().valid('ADMIN', 'MANAGER', 'BRANCH_USER', 'ACCOUNTS', 'PACKAGER', 'DISPATCHER').optional(),
      branchId: Joi.string().allow(null, ''),
      password: Joi.string().min(6).optional() // Allow admin to reset password
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.message });

    const { role, branchId, phoneNumber, password, ...rest } = value;
    const data = { ...rest };
    
    if (role) data.role = role;
    // For roles that can be branch-scoped, set branchId. Otherwise clear it.
    if (role && ['BRANCH_USER', 'PACKAGER', 'DISPATCHER'].includes(role)) {
      data.branchId = branchId || null;
    } else if (role) {
      data.branchId = null;
    }
    // Update phone if provided
    if (typeof phoneNumber !== 'undefined') data.phoneNumber = phoneNumber || null;
    
    // Admin can reset user password
    if (password) {
      const saltRounds = 12;
      data.password = await bcrypt.hash(password, saltRounds);
    }

    const user = await prisma.user.update({ where: { id: req.params.id }, data });
    res.json({ success: true, data: { id: user.id } });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ success: false, message: 'Failed to update user' });
  }
};

const deactivateUser = async (req, res) => {
  try {
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ success: true, data: { id: user.id } });
  } catch (error) {
    console.error('Deactivate user error:', error);
    res.status(500).json({ success: false, message: 'Failed to deactivate user' });
  }
};

const deleteUser = async (req, res) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    console.error('Delete user error:', error);
    // If already deleted or not found
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
};

const resetUserPassword = async (req, res) => {
  try {
    const schema = Joi.object({
      newPassword: Joi.string().min(6).required()
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.message });

    const { newPassword } = value;
    const userId = req.params.id;

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Hash new password (same salt rounds as auth controller)
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    res.json({
      success: true,
      message: `Password reset successfully for user ${user.email}`,
      data: { userId, email: user.email }
    });
  } catch (error) {
    console.error('Reset user password error:', error);
    res.status(500).json({ success: false, message: 'Failed to reset user password' });
  }
};

module.exports = {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deactivateUser,
  deleteUser,
  resetUserPassword
};


