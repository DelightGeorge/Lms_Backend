// emails/verificationEmail.js

const verificationEmail = (fullName, verifyLink) => `
  <div style="font-family: 'Arial', sans-serif; background-color: #f9fafb; padding: 50px 0;">
    <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 6px 18px rgba(0,0,0,0.1);">
      
      <!-- Header -->
      <div style="background: linear-gradient(90deg, #6366f1, #818cf8); color: #fff; text-align: center; padding: 50px 20px;">
        <h1 style="margin: 0; font-size: 32px;">🎓 Welcome to LMS!</h1>
        <p style="margin-top: 10px; font-size: 16px;">Let's get you started by verifying your email</p>
      </div>

      <!-- Body -->
      <div style="padding: 40px 30px; color: #111827; line-height: 1.6;">
        <p>Hi <strong>${fullName || "there"}</strong>,</p>
        <p>Thanks for signing up! To complete your registration, please verify your email by clicking the button below:</p>

        <div style="text-align: center; margin: 40px 0;">
          <a href="${verifyLink}"
            style="background-color: #6366f1; color: #ffffff; padding: 15px 35px; border-radius: 8px; font-weight: bold; text-decoration: none; display: inline-block; font-size: 16px;">
            Verify My Email
          </a>
        </div>

        <p>If the button above doesn't work, copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #4f46e5;">${verifyLink}</p>

        <p>We're excited to have you on board!<br/>The LMS Team</p>
      </div>

      <!-- Footer -->
      <div style="background-color: #f3f4f6; color: #6b7280; text-align: center; font-size: 12px; padding: 20px;">
        &copy; ${new Date().getFullYear()} LMS. All rights reserved.
      </div>

    </div>
  </div>
`;

module.exports = verificationEmail;
