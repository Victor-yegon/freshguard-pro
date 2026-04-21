/**
 * Simple test to verify email credentials work
 * Run with: bun run test-email.mjs
 */
import nodemailer from "nodemailer";

console.log("=== Email Configuration Diagnostic ===\n");

// Check environment variables
const gmailUser = process.env.GMAIL_USER;
const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

console.log("Environment Variables:");
console.log(`  GMAIL_USER: ${gmailUser || "NOT SET ❌"}`);
console.log(`  GMAIL_APP_PASSWORD: ${gmailAppPassword ? `Set (${gmailAppPassword.replace(/./g, "*").substring(0, 16)}...)` : "NOT SET ❌"}`);

if (!gmailUser || !gmailAppPassword) {
  console.log("\n❌ Missing credentials. Cannot test.");
  process.exit(1);
}

// Remove spaces from password (as the app does)
const cleanPassword = gmailAppPassword.replace(/\s+/g, "");
console.log(`  Password (cleaned): ${cleanPassword.substring(0, 8)}...`);

// Create transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: gmailUser,
    pass: cleanPassword,
  },
});

console.log("\nAttempting SMTP connection...");

// Test the connection
transporter.verify((err, success) => {
  if (err) {
    console.error("\n❌ SMTP Connection Failed:");
    console.error(err.message);
    console.error("\nPossible fixes:");
    console.error("1. Check Gmail credentials in .env");
    console.error("2. Ensure Gmail app password is correct (not your regular password)");
    console.error("3. Check if 2FA is enabled on your Google account");
    console.error("4. Verify internet connection");
    process.exit(1);
  }

  console.log("✅ SMTP connection successful!");
  console.log("\nEmail system is configured correctly.");
  console.log(
    `Emails will be sent from: ${gmailUser}`,
  );
  process.exit(0);
});
