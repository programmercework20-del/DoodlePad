import axios from "axios";

export const sendSmsOtp = async (phone, otp, templateId) => {
  try {
    // 🧹 Double Sanitization: Taki MSG91 ko '91919876...' na chala jaye
    const cleanPhone = phone.replace(/^\+91/, '').replace(/^91/, '').trim();

    console.log("🚀 Sending MSG91 OTP:", { cleanPhone, otp, templateId });

    const response = await axios.post(
      "https://control.msg91.com/api/v5/otp",
      {
        mobile: `91${cleanPhone}`, // India default fallback
        otp,
        template_id: templateId
      },
      {
        headers: {
          authkey: process.env.MSG91_AUTH_KEY,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("✅ MSG91 Success:", response.data);
    return response.data;

  } catch (error) {
    console.error("❌ MSG91 API ERROR ❌");
    console.error("STATUS:", error.response?.status || "Network Issue");
    console.error("DATA:", error.response?.data || error.message);
    
    // Server ko crash hone se bacha kar proper error throw karo
    throw new Error("Failed to send SMS via MSG91");
  }
};
// Note: Ensure you have the correct template ID and that your MSG91 account is properly set up to send OTPs.