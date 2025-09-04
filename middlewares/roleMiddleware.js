import passport from "passport";

// Middleware to authenticate user with JWT
export const authenticate = (req, res, next) => {
  passport.authenticate("jwt", { session: false }, (err, user, info) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Authentication error",
        error: err.message,
      });
    }

    if (!user) {
      // Log failed authentication attempt
      // Log failed authentication attempt (audit log removed)
      //   user: null,
      //   action: 'LOGIN_ATTEMPT_FAILED',
      //   entity: 'SYSTEM',
      //   details: { reason: info?.message || 'Invalid token' },
      //   ipAddress: req.ip,
      //   userAgent: req.get('User-Agent'),
      //   description: 'Failed authentication attempt'
      // });

      return res.status(401).json({
        success: false,
        message: "Unauthorized access",
        error: info?.message || "Invalid token",
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account is deactivated",
      });
    }

    req.user = user;
    next();
  })(req, res, next);
};

// Middleware to check if user has super admin role
export const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  if (req.user.role !== "super_admin" && req.user.role !== "admin") {
    // Unauthorized access attempt

    return res.status(403).json({
      success: false,
      message: "Super admin access required",
    });
  }

  next();
};

// Middleware to check if user can manage users
export const requireUserManagement = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  const canManage =
    req.user.role === "super_admin" ||
    req.user.role === "admin" ||
    req.user.permissions?.canManageUsers;

  if (!canManage) {
    return res.status(403).json({
      success: false,
      message: "User management permission required",
    });
  }

  next();
};

// Middleware to check if user can manage products
export const requireProductManagement = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  const canManage =
    req.user.role === "super_admin" ||
    req.user.role === "admin" ||
    req.user.permissions?.canManageProducts;

  if (!canManage) {
    return res.status(403).json({
      success: false,
      message: "Product management permission required",
    });
  }

  next();
};

// Middleware to check if user can view reports
export const requireReportAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  const canView =
    req.user.role === "super_admin" ||
    req.user.role === "admin" ||
    req.user.permissions?.canViewReports;

  if (!canView) {
    return res.status(403).json({
      success: false,
      message: "Report access permission required",
    });
  }

  next();
};

// Middleware to check if user can record sales
export const requireSalesAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  const canRecord =
    req.user.role === "super_admin" ||
    req.user.role === "admin" ||
    req.user.role === "normal_user" ||
    req.user.permissions?.canRecordSales;

  if (!canRecord) {
    return res.status(403).json({
      success: false,
      message: "Sales recording permission required",
    });
  }

  next();
};

// Middleware to check if user can access their own data or is admin
export const requireOwnershipOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  const isAdmin = req.user.role === "super_admin" || req.user.role === "admin";
  const userId = req.params.userId || req.params.id;
  const isOwner = userId && req.user._id.toString() === userId;

  if (!isAdmin && !isOwner) {
    return res.status(403).json({
      success: false,
      message: "Access denied - insufficient permissions",
    });
  }

  next();
};
