import { Router } from "express";
import {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  toggleUserStatus,
  deleteUser,
  getUserActivity
} from "../controllers/userManagement.js";
import { 
  catchAsync,
  authenticate,
  requireUserManagement,
  requireOwnershipOrAdmin
} from "../middlewares/index.js";

export const userManagementRoutes = Router();

// User Management Routes (Requires proper permissions)
userManagementRoutes.post("/", 
  authenticate,
  requireUserManagement,
  catchAsync(createUser)
);

userManagementRoutes.get("/", 
  authenticate,
  requireUserManagement,
  catchAsync(getAllUsers)
);

userManagementRoutes.get("/:id", 
  authenticate,
  requireOwnershipOrAdmin,
  catchAsync(getUserById)
);

userManagementRoutes.put("/:id", 
  authenticate,
  requireUserManagement,
  catchAsync(updateUser)
);

userManagementRoutes.patch("/:id/toggle-status", 
  authenticate,
  requireUserManagement,
  catchAsync(toggleUserStatus)
);

userManagementRoutes.delete("/:id", 
  authenticate,
  requireUserManagement,
  catchAsync(deleteUser)
);

userManagementRoutes.get("/:id/activity", 
  authenticate,
  requireOwnershipOrAdmin,
  catchAsync(getUserActivity)
);

export default userManagementRoutes;
