const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const prisma = require('../lib/prisma'); // reuse shared prisma client

/**
 * Register a new user (Admin/Manager only)
 * POST /api/auth/register
 */
const register = async (req, res) => {
  try {
    // Validation schema
    const schema = Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(6).required(),
      firstName: Joi.string().min(2).max(50).required(),
      lastName: Joi.string().min(2).max(50).required(),
      phoneNumber: Joi.string().allow(null, ''),
      role: Joi.string().valid('ADMIN', 'MANAGER', 'BRANCH_USER', 'ACCOUNTS').required(),
      branchId: Joi.string().optional()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const { email, password, firstName, lastName, phoneNumber, role, branchId } = value;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists.'
      });
    }

    // Validate branch exists if branchId is provided
    if (branchId) {
      const branch = await prisma.branch.findUnique({
        where: { id: branchId }
      });

      if (!branch) {
        return res.status(400).json({
          success: false,
          message: 'Branch not found.'
        });
      }
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        phoneNumber: phoneNumber || null,
        role,
        branchId: branchId || null
      },
      include: {
        branch: true
      }
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.status(201).json({
      success: true,
      message: 'User created successfully.',
      data: userWithoutPassword
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during registration.'
    });
  }
};

/**
 * Login user
 * POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    // Validation schema
    const schema = Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const { email, password } = value;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        branch: true
      }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact administrator.'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Create JWT token
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      branchId: user.branchId
    };

    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        user: userWithoutPassword,
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during login.'
    });
  }
};

/**
 * Get current user profile
 * GET /api/auth/profile
 */
const getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        branch: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      data: userWithoutPassword
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching profile.'
    });
  }
};

/**
 * Update user profile
 * PUT /api/auth/profile
 */
const updateProfile = async (req, res) => {
  try {
    // Validation schema
    const schema = Joi.object({
      firstName: Joi.string().min(2).max(50).optional(),
      lastName: Joi.string().min(2).max(50).optional(),
      email: Joi.string().email().optional(),
      phoneNumber: Joi.string().allow(null, '')
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    // Check if email is being changed and if it's already taken
    if (value.email && value.email !== req.user.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email: value.email }
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email is already taken.'
        });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: value,
      include: {
        branch: true
      }
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = updatedUser;

    res.json({
      success: true,
      message: 'Profile updated successfully.',
      data: userWithoutPassword
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while updating profile.'
    });
  }
};

/**
 * Change password
 * PUT /api/auth/change-password
 */
const changePassword = async (req, res) => {
  try {
    // Validation schema
    const schema = Joi.object({
      currentPassword: Joi.string().required(),
      newPassword: Joi.string().min(6).required()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const { currentPassword, newPassword } = value;

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect.'
      });
    }

    // Hash new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedNewPassword }
    });

    res.json({
      success: true,
      message: 'Password changed successfully.'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while changing password.'
    });
  }
};

/**
 * Logout (client-side token removal, but we can log it for audit)
 * POST /api/auth/logout
 */
const logout = async (req, res) => {
  try {
    // In a more sophisticated setup, you might want to blacklist the token
    // For now, we'll just return success as the client will remove the token
    
    res.json({
      success: true,
      message: 'Logout successful.'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during logout.'
    });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  logout
};
