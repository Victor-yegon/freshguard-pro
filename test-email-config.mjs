#!/usr/bin/env node
import nodemailer from "nodemailer";

const gmailUser = process.env.GMAIL_USER;
const gmailAppPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");

console.log("=== Email Configuration Test ===\n");
console.log(`Gmail User: ${gmailUser ? "✓ Set" : "✗ Missing"}`);
console.log(`Gmail App Password: ${gmailAppPassword ? "✓ Set" : "✗ Missing"}`);

if (!gmailUser || !gmailAppPassword) {
  console.error("\n❌ Email configuration incomplete!");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: gmailUser,
    pass: gmailAppPassword,
  },
});

console.log("\nTesting email transporter connection...\n");

transporter.verify((error, success) => {
  if (error) {
    console.error("❌ SMTP Connection Error:");
    console.error(error.message);
    console.error("\nCommon causes:");
    console.error("1. Incorrect Gmail app password");
    console.error("2. Gmail account security settings");
    console.error("3. Network connectivity issues");
    process.exit(1);
  } else {
    console.log("✓ SMTP Connection successful!");
    console.log("✓ Ready to send emails\n");

    // Send a test email
    console.log("Sending test email...\n");
    transporter.sendMail(
      {
        from: `FoodSafe Monitor <${gmailUser}>`,
        to: gmailUser,
        subject: "🧪 FreshGuard Test Email",
        text: "If you're reading this, the email system is working!",
        html: "<h2>🧪 Test Email</h2><p>If you're reading this, the email system is working!</p>",
      },
      (error, info) => {
        if (error) {
          console.error("❌ Failed to send test email:");
          console.error(error.message);
          process.exit(1);
        } else {
          console.log("✓ Test email sent successfully!");
          console.log(`Response ID: ${info.response}`);
          console.log("\nEmail system is ready for spoilage alerts.");
          process.exit(0);
        }
      },
    );
  }
});
