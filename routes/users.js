import { Router } from "express";
import passport from "passport";
import {
  login,
  signup,
} from "../controllers/users.js";
import { catchAsync } from "../middlewares/index.js";

export const authRoutes = Router();

// auth routes
authRoutes.post("/signup", catchAsync(signup));
authRoutes.post("/login", catchAsync(login));



export default authRoutes;
