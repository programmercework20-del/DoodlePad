import nodemailer from "nodemailer";

export const sendEmail = async (to, subject, type, data = {}) => {
  try {
    console.log("📧 Sending email to:", to);

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    let html = "";

    // ==============================
    // 🔥 OTP EMAIL TEMPLATE (MAIN)
    // ==============================
    if (type === "otp") {
      html = `
      <!DOCTYPE html>
      <html>
      <body style="margin:0; padding:0; background:#f4f4f4; font-family:Arial;">

        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center">

              <table width="500" cellpadding="0" cellspacing="0" 
                     style="background:#111; color:#fff; margin-top:40px; padding:30px; border-radius:10px;">

                <tr>
                  <td>
                    <h2 style="margin:0;">Verify your account</h2>
                  </td>
                </tr>

                <tr>
                  <td style="padding-top:20px;">
                    <p>Your OTP code is:</p>
                    <h1 style="letter-spacing:5px;">${data.otp}</h1>
                    <p>This OTP is valid for 5 minutes.</p>
                  </td>
                </tr>

                <tr>
                  <td>
                    <p style="font-size:12px; color:#aaa;">
                      If you didn’t request this, ignore this email.
                    </p>
                  </td>
                </tr>

              </table>

            </td>
          </tr>
        </table>

      </body>
      </html>
      `;
    }

    // ==============================
    // 🔥 FALLBACK TEMPLATE (IMPORTANT)
    // ==============================
    if (!html) {
      html = `<p>No content available</p>`;
    }

    // ==============================
    // 🔥 SEND MAIL
    // ==============================
    const info = await transporter.sendMail({
      from: `"DoodlePad Support" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,

      // 👇 VERY IMPORTANT (fix blank mail / spam issue)
      text: type === "otp"
        ? `Your OTP is: ${data?.otp}`
        : "DoodlePad Notification"
    });

    console.log("✅ Email sent:", info.response);

  } catch (error) {
    console.error("❌ Email error:", error);
  }
};