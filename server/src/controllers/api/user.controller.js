import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../../models/User.js";

// export const signup = async (req, res) => {
//   try {
//     const { email, username, name, password } = req.body;

//     const existingUser = await User.findOne({ where: { email } });
//     if (existingUser) {
//       return res.status(400).json({ message: "Email already exists" });
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);

//     const user = await User.create({
//       email,
//       username,
//       name,
//       password: hashedPassword
//     });

//     return res.status(201).json({
//       message: "Signup successful",
//       user: {
//         id: user.id,
//         email: user.email,
//         username: user.username
//       }
//     });

//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Signup failed" });
//   }
// };

export const signup = async (req, res) => {
  try {
    const {
      email,
      username,
      name,
      password,
      profilePhoto,
      bio,
      dateOfBirth,
      gender
    } = req.body;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      username,
      name,
      password: hashedPassword,
      profilePhoto,
      bio,
      dateOfBirth,
      gender
    });

    return res.status(201).json({
      message: "Signup successful",
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        profilePhoto: user.profilePhoto,
        bio: user.bio,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Signup failed" });
  }
};


export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    await user.update({ lastActiveAt: new Date() });

    return res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Login failed" });
  }
};
