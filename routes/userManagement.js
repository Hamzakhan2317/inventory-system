import { Router } from "express";
import {
  createUser,
  getAllUsers,
  getUnverifiedBusinessCustomers,
  verifyBusinessCustomer,
  getUserById,
  updateUser,
  updateUserBasic,
  toggleUserStatus,
  deleteUser,
  getUserActivity,
  removeProfileImage
} from "../controllers/userManagement.js";
import { 
  catchAsync,
  requireUserManagement,
  requireOwnershipOrAdmin
} from "../middlewares/index.js";

export const userManagementRoutes = Router();

// User Management Routes (Requires proper permissions)
userManagementRoutes.post("/", 
  requireUserManagement,
  catchAsync(createUser)
);

userManagementRoutes.get("/", 
  requireUserManagement,
  catchAsync(getAllUsers)
);

userManagementRoutes.get("/unverified-business-customers", 
  // requireUserManagement,
  catchAsync(getUnverifiedBusinessCustomers)
);

userManagementRoutes.patch("/verify-business-customer/:id", 
  // requireUserManagement,
  catchAsync(verifyBusinessCustomer)
);

userManagementRoutes.get("/:id", 
  requireOwnershipOrAdmin,
  catchAsync(getUserById)
);

// Update user with file upload support (profile image)
userManagementRoutes.put("/:id", 
  // requireUserManagement,
  catchAsync(updateUser)
);

// Update user basic fields only (no file upload)
userManagementRoutes.patch("/:id/basic", 
  requireUserManagement,
  catchAsync(updateUserBasic)
);

userManagementRoutes.patch("/:id/toggle-status", 
  requireUserManagement,
  catchAsync(toggleUserStatus)
);

userManagementRoutes.delete("/:id", 
  requireUserManagement,
  catchAsync(deleteUser)
);

userManagementRoutes.get("/:id/activity", 
  requireOwnershipOrAdmin,
  catchAsync(getUserActivity)
);

userManagementRoutes.delete("/:id/profile-image", 
  requireUserManagement,
  catchAsync(removeProfileImage)
);

export default userManagementRoutes;
