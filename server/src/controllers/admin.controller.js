import bcrypt from 'bcrypt';
import { Admin } from '../models/index.js';
import { generateToken } from '../utils/jwt.js';
import { sendEmail } from "../utils/sendEmail.js";



// Admin Login
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

export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.json(400).json({
                success: false,
                message: "Email is required"
            });
        }

        const admin = await Admin.findOne({
            where: { email }
        });

        if (!admin) {

            return res.status(404).json({
                success: false,
                message: "Admin not found"
            });

        }

        if (!admin.isActive) {

            return res.status(403).json({
                success: false,
                message: "Account is deactivated"
            });

        }

        const otp = Math.floor(1000 + Math.random() * 9000).toString();

        await admin.update({
            otp,
            otpExpires: new Date(
                Date.now() + 5 * 60 * 1000
            ),
            otpVerified: false
        });

        await sendEmail(
            admin.email,
            "Admin Reset Password OTP",
            "otp",
            { otp }
        );

        return res.status(200).json({

            success: true,
            message: "OTP sent successfully"

        });

    } catch (error) {

        console.error("FORGOT PASSWORD ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to send OTP"
        });

    }

};

// ========================================
// VERIFY RESET OTP
// ========================================

export const verifyResetOtp = async (req, res) => {

    try {

        const { email, otp } = req.body;

        if (!email || !otp) {

            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });

        }

        const admin = await Admin.findOne({
            where: { email }
        });

        if (!admin) {

            return res.status(404).json({
                success: false,
                message: "Admin not found"
            });

        }

        // Check OTP
        if (

            admin.otp !== otp ||
            admin.otpExpires < new Date()

        ) {

            return res.status(400).json({
                success: false,
                message: "Invalid or expired OTP"
            });

        }

        await admin.update({

            otpVerified: true,
            otp: null,
            otpExpires: null

        });

        return res.status(200).json({

            success: true,
            message: "OTP verified successfully"

        });

    } catch (error) {

        console.error("VERIFY OTP ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "OTP verification failed"
        });

    }
};

// ========================================
// RESET PASSWORD
// ========================================

export const resetPassword = async (req, res) => {

    try {

        const {
            email,
            password,
            confirmPassword
        } = req.body;

        // Validation
        if (
            !email ||
            !password ||
            !confirmPassword
        ) {

            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });

        }

        if (password !== confirmPassword) {

            return res.status(400).json({
                success: false,
                message: "Passwords do not match"
            });

        }

        if (password.length < 6) {

            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters"
            });

        }

        const admin = await Admin.findOne({
            where: { email }
        });

        if (!admin) {

            return res.status(404).json({
                success: false,
                message: "Admin not found"
            });

        }

        // OTP verified check
        if (!admin.otpVerified) {

            return res.status(403).json({
                success: false,
                message: "Please verify OTP first"
            });

        }

        // Hash password
        const hashedPassword =
            await bcrypt.hash(password, 10);

        // Update password
        await admin.update({

            password: hashedPassword,
            otpVerified: false

        });

        return res.status(200).json({

            success: true,
            message: "Password reset successful"

        });

    } catch (error) {

        console.error("RESET PASSWORD ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Reset password failed"
        });

    }

};