  /**
 * Role-based access control middleware
 * Checks if the authenticated user has the required role(s)
 * 
 * @param {string|string[]} allowedRoles - Single role or array of roles that are allowed
 * @returns {Function} Express middleware function
 */
const roleMiddleware = (allowedRoles) => {
  return (req, res, next) => {
    try {
      // Check if user is authenticated (authMiddleware should run first)
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required.'
        });
      }

      // Convert single role to array for consistent handling
      const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

      // Check if user's role is in the allowed roles
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required role(s): ${roles.join(', ')}. Your role: ${req.user.role}`
        });
      }

      next();
    } catch (error) {
      console.error('Role middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error during role verification.'
      });
    }
  };
};

/**
 * Convenience functions for common role checks
 */
const requireAdmin = roleMiddleware(['ADMIN']);
const requireManager = roleMiddleware(['ADMIN', 'MANAGER']);
const requireBranchUser = roleMiddleware(['ADMIN', 'MANAGER', 'BRANCH_USER']);
const requireAccounts = roleMiddleware(['ADMIN', 'ACCOUNTS']);
// New convenience middleware for Packager and Dispatcher roles
const requirePackager = roleMiddleware(['ADMIN', 'MANAGER', 'PACKAGER']);
const requireDispatcher = roleMiddleware(['ADMIN', 'MANAGER', 'DISPATCHER']);

/**
 * Middleware to check if user can access branch-specific data
 * Ensures users can only access data from their own branch (unless they're admin)
 */
const branchAccessMiddleware = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    // Admins can access all branches
    if (req.user.role === 'ADMIN') {
      return next();
    }

    // Get branch ID from request (could be in params, query, or body)
    const requestedBranchId = req.params.branchId || req.query.branchId || req.body.branchId;

    // If no branch specified, allow access (will be filtered by user's branch in controllers)
    if (!requestedBranchId) {
      return next();
    }

    // Check if user's branch matches the requested branch
    if (req.user.branchId !== requestedBranchId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only access data from your assigned branch.'
      });
    }

    next();
  } catch (error) {
    console.error('Branch access middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during branch access verification.'
    });
  }
};

module.exports = {
  roleMiddleware,
  requireAdmin,
  requireManager,
  requireBranchUser,
  requireAccounts,
  requirePackager,
  requireDispatcher,
  branchAccessMiddleware
};
