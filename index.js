import express from "express";
import bodyParser from "body-parser";
import cors from "cors";

import productRoutes from "./routes/products.js";
import salesRoutes from "./routes/sales.js";
import reportingRoutes from "./routes/reporting.js";
import passport from "passport";
import "dotenv/config";
import { connectDB } from "./database/db.js";
import { serverError, passportMiddleware } from "./middlewares/index.js";
import UserManagementRoutes from "./routes/userManagement.js";
const app = express();
const { PORT } = process.env;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(cors());
app.use(passport.initialize());
passportMiddleware(passport);

//---------------serverFolder----------
app.use("/uploads", express.static("uploads"));


//---------------- API ROUTES --------------------
app.use("/api", UserManagementRoutes);
app.use("/api/products", productRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/reports", reportingRoutes);


app.get("/*", (req, res) => {
  res.status(404).json({ message: "No Such Route Exists!" });
});

// Start server
app.listen(PORT, async () => {
  console.log(`Server Running On Port ${PORT}`);
  
  // Verify database connection on startup
  try {
    await connectDB();
    console.log("✅ Database connection established");
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
  }
});

app.use(serverError);
