import passport from "passport";

const publicRoutes = [
  "/api/auth",
];

export const authMiddleware = (req, res, next) => {
  // Skip authentication for auth routes like /auth/auth
  if (publicRoutes.some((route) => req.path.startsWith(route))) {
    return next(); // Skip authentication for auth routes
  }

  passport.authenticate("jwt", { session: false }, (err, user, info) => {
    if (err) {
      return res.status(500).json({
        message: "Authentication error",
        error: err,
        errorType: "AUTH_ERROR",
      });
    }
    if (!user) {
      let message = "Unauthorized access";
      let errorType = "UNAUTHORIZED";

      switch (info?.name) {
        case "TokenExpiredError":
          message = "Token expired. Please log in again.";
          errorType = "TOKEN_EXPIRED";
          break;
        case "JsonWebTokenError":
          message = "Invalid token. Please log in again.";
          errorType = "INVALID_TOKEN";
          break;
        case "NotBeforeError":
          message = "Token not active yet.";
          errorType = "TOKEN_NOT_ACTIVE";
          break;
      }
      return res.status(401).json({
        message,
        errorType,
        requiresReauth: true,
      });
    }

    
    // Add timezone to user object
    req.user = user;
    
    next();
  })(req, res, next);
};


// Middleware for refresh token authentication (reads from httpOnly cookie)
export const requireRefreshToken = passport.authenticate("jwt-refresh", {
  session: false,
});

// Middleware for refresh token authentication with specific strategy
export const refreshAuthMiddleware = (req, res, next) => {
  passport.authenticate(
    "jwt-refresh",
    { session: false },
    (err, user, info) => {
      if (err) {
        return res.status(500).json({
          message: "Refresh authentication error",
          error: err,
          errorType: "REFRESH_AUTH_ERROR",
        });
      }

      if (!user) {
        let message = "Unauthorized refresh attempt";
        let errorType = "REFRESH_UNAUTHORIZED";

        switch (info?.name) {
          case "TokenExpiredError":
            message = "Refresh token expired. Please log in again.";
            errorType = "REFRESH_TOKEN_EXPIRED";
            break;
          case "JsonWebTokenError":
            message = "Invalid refresh token. Please log in again.";
            errorType = "REFRESH_INVALID_TOKEN";
            break;
          case "NotBeforeError":
            message = "Refresh token not active yet.";
            errorType = "REFRESH_TOKEN_NOT_ACTIVE";
            break;
        }

        return res.status(401).json({
          message,
          errorType,
          requiresReauth: true, // tell frontend to force re-login
        });
      }

      req.user = user; // attach user for controller
      next();
    }
  )(req, res, next);
};
