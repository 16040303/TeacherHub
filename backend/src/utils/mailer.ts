import nodemailer from "nodemailer";
import { env } from "../config/env";

const hasSmtpConfig = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);

const transporter = hasSmtpConfig
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    })
  : null;

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

const sendMail = async (options: SendMailOptions): Promise<void> => {
  if (!transporter) {
    console.log("─────────────────────────────────────────────");
    console.log("📧 Email (SMTP not configured — dev console)");
    console.log(`   To:      ${options.to}`);
    console.log(`   Subject: ${options.subject}`);
    console.log(`   Body:\n${options.html}`);
    console.log("─────────────────────────────────────────────");
    return;
  }

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });
};

export const sendVerificationEmail = async (
  to: string,
  fullName: string,
  rawToken: string
): Promise<void> => {
  const verifyUrl = `${env.FRONTEND_URL}/verify-email?token=${encodeURIComponent(rawToken)}`;

  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
      <h2 style="color: #1e293b; margin-bottom: 8px;">Welcome to TeacherHub!</h2>
      <p style="color: #475569; font-size: 15px; line-height: 1.6;">
        Hi <strong>${fullName}</strong>,
      </p>
      <p style="color: #475569; font-size: 15px; line-height: 1.6;">
        Thank you for registering. Please verify your email address by clicking the button below:
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${verifyUrl}"
           style="display: inline-block; background-color: #6366f1; color: #ffffff; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px;">
          Verify Email Address
        </a>
      </div>
      <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
        If the button doesn't work, copy and paste this link into your browser:
      </p>
      <p style="color: #6366f1; font-size: 13px; word-break: break-all;">
        ${verifyUrl}
      </p>
      <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">
        This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
      </p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 11px;">
        &copy; ${new Date().getFullYear()} TeacherHub. All rights reserved.
      </p>
    </div>
  `;

  await sendMail({
    to,
    subject: "Verify your TeacherHub email address",
    html,
  });
};

export const sendResetPasswordEmail = async (
  to: string,
  fullName: string,
  rawToken: string
): Promise<void> => {
  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(rawToken)}`;

  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
      <h2 style="color: #1e293b; margin-bottom: 8px;">Reset your TeacherHub password</h2>
      <p style="color: #475569; font-size: 15px; line-height: 1.6;">
        Hi <strong>${fullName}</strong>,
      </p>
      <p style="color: #475569; font-size: 15px; line-height: 1.6;">
        We received a request to reset your password. Click the button below to choose a new password:
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${resetUrl}"
           style="display: inline-block; background-color: #6366f1; color: #ffffff; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px;">
          Reset Password
        </a>
      </div>
      <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
        If the button doesn't work, copy and paste this link into your browser:
      </p>
      <p style="color: #6366f1; font-size: 13px; word-break: break-all;">
        ${resetUrl}
      </p>
      <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">
        This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
      </p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 11px;">
        &copy; ${new Date().getFullYear()} TeacherHub. All rights reserved.
      </p>
    </div>
  `;

  await sendMail({
    to,
    subject: "Reset your TeacherHub password",
    html,
  });
};
