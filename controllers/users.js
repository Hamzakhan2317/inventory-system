import { BadRequest, logIn } from "../middlewares/index.js";
import { User } from "../models/index.js";
// User LogIn
export const login = async (req, res) => {
  const { email, password } = req.body;
  console.log("email, pasword", email, password);
  if (![email, password].every(Boolean))
    throw new BadRequest("Please fill all inputs!");

  const user = await User.findOneAndUpdate({ email }, { isLoggedIn: false });

  if (!user || !user.comparePassword(password)) {
    throw new BadRequest("Incorrect email or password");
  }

  const token = await logIn({ _id: user?._id });

  res.status(200).json({
    success: true,
    message: "Login Successflly!",
    token,
    user,
  });
};