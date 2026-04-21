import { createServerFn } from "@tanstack/react-start";
import nodemailer from "nodemailer";
import { z } from "zod";

const ContactInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(200),
  message: z.string().trim().min(5).max(3000),
});

export const sendContactMessage = createServerFn({ method: "POST" })
  .inputValidator(ContactInputSchema)
  .handler(async ({ data }) => {
    const gmailUser = process.env.GMAIL_USER;
    const gmailAppPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");

    if (!gmailUser || !gmailAppPassword) {
      throw new Error("Email delivery is not configured. Missing Gmail credentials on server.");
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailAppPassword,
      },
    });

    await transporter.sendMail({
      from: `FoodSafe Monitor <${gmailUser}>`,
      to: gmailUser,
      replyTo: `${data.name} <${data.email}>`,
      subject: `Contact form message from ${data.name}`,
      text: [
        `Name: ${data.name}`,
        `Email: ${data.email}`,
        "",
        "Message:",
        data.message,
      ].join("\n"),
      html: `
        <h2>New contact message</h2>
        <p><strong>Name:</strong> ${escapeHtml(data.name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(data.email)}</p>
        <p><strong>Message:</strong></p>
        <p style="white-space: pre-wrap;">${escapeHtml(data.message)}</p>
      `,
    });

    return { ok: true as const };
  });

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
