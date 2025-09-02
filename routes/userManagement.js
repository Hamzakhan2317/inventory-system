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
userManagementRoutes.post("/users", 
  authenticate,
  requireUserManagement,
  catchAsync(createUser)
);

userManagementRoutes.get("/users", 
  authenticate,
  requireUserManagement,
  catchAsync(getAllUsers)
);

userManagementRoutes.get("/users/:id", 
  authenticate,
  requireOwnershipOrAdmin,
  catchAsync(getUserById)
);

userManagementRoutes.put("/users/:id", 
  authenticate,
  requireUserManagement,
  catchAsync(updateUser)
);

userManagementRoutes.patch("/users/:id/toggle-status", 
  authenticate,
  requireUserManagement,
  catchAsync(toggleUserStatus)
);

userManagementRoutes.delete("/users/:id", 
  authenticate,
  requireUserManagement,
  catchAsync(deleteUser)
);

userManagementRoutes.get("/users/:id/activity", 
  authenticate,
  requireOwnershipOrAdmin,
  catchAsync(getUserActivity)
);

export default userManagementRoutes;
