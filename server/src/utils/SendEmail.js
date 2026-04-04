import nodemailer from "nodemailer";

export const sendEmail = async (to, subject, type, data) => {
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

    // 🔥 TEMPLATE SWITCH
    if (type === "verify-email") {
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
                <h2 style="margin:0;">Confirm your email</h2>
              </td>
            </tr>

            <tr>
              <td style="padding-top:20px;">
                <p>Thanks for signing up for <b>DoodlePad</b> 🎨</p>
                <p>Please confirm your email by clicking below:</p>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:25px 0;">
                <a href="${data.url}"
                  style="
                    background:#000;
                    color:#fff;
                    padding:12px 24px;
                    text-decoration:none;
                    border-radius:8px;
                    display:inline-block;
                    font-weight:bold;
                  ">
                  Verify Email
                </a>
                <p style="margin-top:20px; font-size:12px;">
  If button not working, copy this link:
</p>

<p style="word-break:break-all; color:lightblue;">
  ${data.url}
</p>
              </td>
              
            </tr>

            <tr>
              <td>
                <p style="font-size:12px; color:#aaa;">
                  If you didn’t create an account, ignore this email.
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
    const info = await transporter.sendMail({
      from: `"DoodlePad Support" <no-reply.doodlepad@gmail.com>`,
      to,
      subject,
      html,
      text: `Verify your email: ${data?.url || ""}` // 👈 IMPORTANT
    });

    console.log("✅ Email sent:", info.response);

  } catch (error) {
    console.error("❌ Email error:", error);
  }
};