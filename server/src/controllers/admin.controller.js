import bcrypt from 'bcrypt';
import { Admin } from '../models/index.js';
import { generateToken } from '../utils/jwt.js';


// Admin Login
// export const login = async (req, res) => {
//     try {
//         const { email, password } = req.body;

//         if (!email || !password) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Email and password are required"
//             });
//         }

//         // Find admin by email
//         const admin = await Admin.findOne({ where: { email } });

//         if (!admin) {
//             return res.status(401).json({
//                 success: false,
//                 message: "Invalid credentials"
//             });
//         }

//         // Check if admin is active
//         if (!admin.isActive) {
//             return res.status(403).json({
//                 success: false,
//                 message: "Account is deactivated"
//             });
//         }

//         // Verify password
//         const isPasswordValid = await bcrypt.compare(password, admin.password);

//         if (!isPasswordValid) {
//             return res.status(401).json({
//                 success: false,
//                 message: "Invalid credentials"
//             });
//         }

//         // Generate JWT token
//         const token = generateToken({
//             id: admin.id,
//             email: admin.email,
//             role: admin.role
//         });

//         // Set HTTP-only cookie (keep it for security as backup or alternative)
//         res.cookie("token", token, {
//             httpOnly: true,
//             secure: process.env.NODE_ENV === "production",
//             sameSite: "strict",
//             maxAge: 24 * 60 * 60 * 1000 // 1 day
//         });

//         res.json({
//             success: true,
//             message: "Login successful",
//             token, // Sending token for localStorage usage
//             data: {
//                 id: admin.id,
//                 email: admin.email,
//                 name: admin.name,
//                 role: admin.role
//             }
//         });
//     } catch (error) {
//         console.error("Login error:", error);
//         res.status(500).json({
//             success: false,
//             message: "Server error during login"
//         });
//     }
// };

export const login = async (req, res) => {

    try {

        const { email, password } = req.body;

        if (!email || !password) {

            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });

        }

        // Find Admin
        const admin = await Admin.findOne({
            where: { email }
        });

        if (!admin) {

            return res.status(401).json({
                success: false,
                message: "Admin not found"
            });

        }

        console.log("Entered Password:", password);
        console.log("Database Hash:", admin.password);

        // Check active status
        if (!admin.isActive) {

            return res.status(403).json({
                success: false,
                message: "Account is deactivated"
            });

        }

        // Compare Password
        const isPasswordValid =
            await bcrypt.compare(
                password,
                admin.password
            );

        console.log("Password Match:", isPasswordValid);

        if (!isPasswordValid) {

            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });

        }

        // Generate Token
        const token = generateToken({
            id: admin.id,
            email: admin.email,
            role: admin.role
        });

        // Cookie
        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 24 * 60 * 60 * 1000
        });

        return res.status(200).json({

            success: true,
            message: "Login successful",

            token,

            data: {
                id: admin.id,
                email: admin.email,
                name: admin.name,
                role: admin.role
            }

        });

    } catch (error) {

        console.error("LOGIN ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Server error during login"
        });

    }

};


// Admin Logout
export const logout = async (req, res) => {
    try {
        res.clearCookie("token");
        res.json({
            success: true,
            message: "Logout successful"
        });
    } catch (error) {
        console.error("Logout error:", error);
        res.status(500).json({
            success: false,
            message: "Server error during logout"
        });
    }
};

// Get Admin Profile
export const getProfile = async (req, res) => {
    try {
        const admin = await Admin.findByPk(req.admin.id, {
            attributes: { exclude: ["password"] }
        });

        if (!admin) {
            return res.status(404).json({
                success: false,
                message: "Admin not found"
            });
        }

        res.json({
            success: true,
            data: admin
        });
    } catch (error) {
        console.error("Get profile error:", error);
        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// Verify Admin Token
export const verify = async (req, res) => {
    try {
        const admin = await Admin.findByPk(req.admin.id, {
            attributes: { exclude: ["password"] }
        });

        if (!admin || !admin.isActive) {
            return res.status(401).json({
                success: false,
                message: "Invalid session"
            });
        }

        res.json({
            success: true,
            data: {
                id: admin.id,
                email: admin.email,
                name: admin.name,
                role: admin.role
            }
        });
    } catch (error) {
        console.error("Verify error:", error);
        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};
