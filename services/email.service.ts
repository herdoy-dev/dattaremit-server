import * as nodemailer from "nodemailer";
import logger from "../lib/logger";

const transporter = nodemailer.createTransport({
  service: "gmail",
  port: 465,
  secure: true,
  auth: {
    user: process.env.GOOGLE_EMAIL || "noreply@dattapay.com",
    pass: process.env.GOOGLE_APP_PASSWORD,
  },
});

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export const sendEmail = async (options: EmailOptions): Promise<boolean> => {
  try {
    const mailOptions: nodemailer.SendMailOptions = {
      from: `"Dattapay" <${process.env.GOOGLE_EMAIL || "noreply@dattapay.com"}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    const atIndex = options.to.indexOf("@");
    const masked = atIndex > 2
      ? options.to.slice(0, 2) + "***" + options.to.slice(atIndex)
      : "***";
    logger.error(`Failed to send email to ${masked}`, { error });
    return false;
  }
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export const sendKycEmail = async (
  to: string,
  kycLink: string,
  userName?: string
): Promise<boolean> => {
  const name = escapeHtml(userName || "there");
  if (!kycLink.startsWith("https://")) {
    logger.error("KYC link rejected: invalid protocol", { link: kycLink.substring(0, 30) });
    return false;
  }
  const safeLink = escapeHtml(encodeURI(kycLink));
  return sendEmail({
    to,
    subject: "Complete Your KYC Verification - Dattapay",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1a1a2e;">Hi ${name},</h2>
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          To complete your account verification, please click the link below to start your KYC process:
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${safeLink}"
             style="background-color: #6366f1; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold;">
            Verify Your Identity
          </a>
        </div>
        <p style="color: #666; font-size: 14px; line-height: 1.5;">
          If the button doesn't work, copy and paste this link into your browser:
          <br/>
          <a href="${safeLink}" style="color: #6366f1;">${escapeHtml(kycLink)}</a>
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
        <p style="color: #999; font-size: 12px;">
          This email was sent by Dattapay. If you didn't request this, please ignore this email.
        </p>
      </div>
    `,
  });
};
