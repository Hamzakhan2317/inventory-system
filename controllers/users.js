import { BadRequest, logIn } from "../middlewares/index.js";
import { User } from "../models/index.js";

// User SignUp
export const signup = async (req, res) => {
  const { name, businessName, email, phone, address, password } = req.body;

  // Validate required fields
  if (![name, email, password].every(Boolean)) {
    throw new BadRequest("Please provide name, email, and password!");
  }

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new BadRequest("User with this email already exists!");
  }

  // Create new user
  const newUser = await User.create({
    name,
    businessName,
    email,
    phone,
    address,
    password,
    role: 'business_customer',
  });

  res.status(201).json({
    success: true,
    message: "User registered successfully!",
    user: newUser,
  });
};

// User LogIn
export const login = async (req, res) => {
  const { email, password } = req.body;
  console.log("email, pasword", email, password);
  if (![email, password].every(Boolean))
    throw new BadRequest("Please fill all inputs!");

  // const user = await User.findOneAndUpdate({ email }, { isLoggedIn: false });
  const user = await User.findOne({ email });

  if (!user || !user.comparePassword(password)) {
    throw new BadRequest("Incorrect email or password");
  }

  // Check if user account is active
  if (!user.isActive) {
    throw new BadRequest("Your account has been deactivated. Please contact administrator.");
  }

  // Check if user is verified
  if (!user.isVerified) {
    throw new BadRequest("Your account is not verified. Please contact administrator.");
  }

  const token = await logIn({ _id: user?._id });

  res.status(200).json({
    success: true,
    message: "Login Successflly!",
    token,
    user,
  });
};