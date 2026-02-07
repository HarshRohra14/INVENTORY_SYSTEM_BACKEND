const { PrismaClient } = require('@prisma/client');

const prisma = require('../lib/prisma'); // reuse shared prisma client

/**
 * Manager Branch Assignment Service
 * Handles assigning managers to branches for order management
 */

/**
 * Assign a manager to a branch
 * @param {string} managerId - ID of the manager
 * @param {string} branchId - ID of the branch
 * @returns {Object} Result of the assignment operation
 */
const assignManagerToBranch = async (managerId, branchId) => {
  try {
    // Verify manager exists and has MANAGER role
    const manager = await prisma.user.findUnique({
      where: { id: managerId },
      select: { id: true, role: true, firstName: true, lastName: true }
    });

    if (!manager) {
      throw new Error('Manager not found');
    }

    if (manager.role !== 'MANAGER') {
      throw new Error('User is not a manager');
    }

    // Verify branch exists
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, name: true }
    });

    if (!branch) {
      throw new Error('Branch not found');
    }

    // Check if assignment already exists
    const existingAssignment = await prisma.managerBranch.findUnique({
      where: {
        managerId_branchId: {
          managerId: managerId,
          branchId: branchId
        }
      }
    });

    if (existingAssignment) {
      if (existingAssignment.isActive) {
        return {
          success: true,
          message: 'Manager is already assigned to this branch',
          assignment: existingAssignment
        };
      } else {
        // Reactivate the assignment
        const reactivatedAssignment = await prisma.managerBranch.update({
          where: { id: existingAssignment.id },
          data: { isActive: true }
        });

        return {
          success: true,
          message: 'Manager assignment reactivated',
          assignment: reactivatedAssignment
        };
      }
    }

    // Create new assignment
    const assignment = await prisma.managerBranch.create({
      data: {
        managerId: managerId,
        branchId: branchId,
        isActive: true
      },
      include: {
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        branch: {
          select: {
            id: true,
            name: true,
            city: true,
            state: true
          }
        }
      }
    });

    return {
      success: true,
      message: 'Manager assigned to branch successfully',
      assignment
    };

  } catch (error) {
    console.error('Assign manager to branch error:', error);
    return {
      success: false,
      message: error.message || 'Failed to assign manager to branch',
      error: error.message
    };
  }
};

/**
 * Remove a manager from a branch
 * @param {string} managerId - ID of the manager
 * @param {string} branchId - ID of the branch
 * @returns {Object} Result of the removal operation
 */
const removeManagerFromBranch = async (managerId, branchId) => {
  try {
    // Find the assignment
    const assignment = await prisma.managerBranch.findUnique({
      where: {
        managerId_branchId: {
          managerId: managerId,
          branchId: branchId
        }
      },
      include: {
        manager: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        branch: {
          select: {
            name: true
          }
        }
      }
    });

    if (!assignment) {
      throw new Error('Manager assignment not found');
    }

    if (!assignment.isActive) {
      return {
        success: true,
        message: 'Manager is already removed from this branch'
      };
    }

    // Deactivate the assignment (soft delete)
    await prisma.managerBranch.update({
      where: { id: assignment.id },
      data: { isActive: false }
    });

    return {
      success: true,
      message: 'Manager removed from branch successfully'
    };

  } catch (error) {
    console.error('Remove manager from branch error:', error);
    return {
      success: false,
      message: error.message || 'Failed to remove manager from branch',
      error: error.message
    };
  }
};

/**
 * Get all branches assigned to a manager
 * @param {string} managerId - ID of the manager
 * @returns {Object} List of assigned branches
 */
const getManagerBranches = async (managerId) => {
  try {
    const assignments = await prisma.managerBranch.findMany({
      where: {
        managerId: managerId,
        isActive: true
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            state: true,
            zipCode: true,
            phone: true,
            email: true
          }
        }
      },
      orderBy: {
        branch: {
          name: 'asc'
        }
      }
    });

    const branches = assignments.map(assignment => assignment.branch);

    return {
      success: true,
      data: branches
    };

  } catch (error) {
    console.error('Get manager branches error:', error);
    return {
      success: false,
      message: 'Failed to fetch manager branches',
      error: error.message
    };
  }
};

/**
 * Get all managers assigned to a branch
 * @param {string} branchId - ID of the branch
 * @returns {Object} List of assigned managers
 */
const getBranchManagers = async (branchId) => {
  try {
    const assignments = await prisma.managerBranch.findMany({
      where: {
        branchId: branchId,
        isActive: true
      },
      include: {
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            isActive: true
          }
        }
      },
      orderBy: {
        manager: {
          firstName: 'asc'
        }
      }
    });

    const managers = assignments.map(assignment => assignment.manager);

    return {
      success: true,
      data: managers
    };

  } catch (error) {
    console.error('Get branch managers error:', error);
    return {
      success: false,
      message: 'Failed to fetch branch managers',
      error: error.message
    };
  }
};

/**
 * Get all manager-branch assignments
 * @param {Object} options - Query options
 * @returns {Object} List of all assignments
 */
const getAllManagerBranchAssignments = async (options = {}) => {
  try {
    const { page = 1, limit = 50, managerId, branchId } = options;
    const skip = (page - 1) * limit;

    // Build where clause
    const where = { isActive: true };
    if (managerId) where.managerId = managerId;
    if (branchId) where.branchId = branchId;

    const [assignments, totalCount] = await Promise.all([
      prisma.managerBranch.findMany({
        where,
        include: {
          manager: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              isActive: true
            }
          },
          branch: {
            select: {
              id: true,
              name: true,
              city: true,
              state: true
            }
          }
        },
        orderBy: [
          { manager: { firstName: 'asc' } },
          { branch: { name: 'asc' } }
        ],
        skip,
        take: limit
      }),
      prisma.managerBranch.count({ where })
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return {
      success: true,
      data: {
        assignments,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNextPage,
          hasPrevPage,
          limit
        }
      }
    };

  } catch (error) {
    console.error('Get all manager branch assignments error:', error);
    return {
      success: false,
      message: 'Failed to fetch manager branch assignments',
      error: error.message
    };
  }
};

module.exports = {
  assignManagerToBranch,
  removeManagerFromBranch,
  getManagerBranches,
  getBranchManagers,
  getAllManagerBranchAssignments
};

