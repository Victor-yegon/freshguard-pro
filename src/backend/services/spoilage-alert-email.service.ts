import nodemailer from "nodemailer";

export type SpoilageAlertEmailInput = {
  to: string;
  productName: string;
  currentRoomName: string;
  currentTemperature: number;
  currentHumidity: number;
  safeTempRange: string;
  safeHumidityRange: string;
  problem: string;
  riskExplanation: string;
  recommendation: string;
  actionTaken: string;
  timestampIso: string;
};

export async function sendSpoilageRiskEmail(input: SpoilageAlertEmailInput) {
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

  const subject = "🚨 Food Spoilage Risk Detected";

  const text = [
    "Food Spoilage Risk Detected",
    "",
    `Product Name: ${input.productName}`,
    `Current Room: ${input.currentRoomName}`,
    `Current Temperature: ${input.currentTemperature.toFixed(1)}°C`,
    `Current Humidity: ${input.currentHumidity.toFixed(1)}%`,
    `Safe Temperature Range: ${input.safeTempRange}`,
    `Safe Humidity Range: ${input.safeHumidityRange}`,
    `Problem: ${input.problem}`,
    `Risk Explanation: ${input.riskExplanation}`,
    `Recommendation: ${input.recommendation}`,
    `Action Taken: ${input.actionTaken}`,
    `Timestamp: ${new Date(input.timestampIso).toLocaleString()}`,
  ].join("\n");

  const html = `
    <h2>🚨 Food Spoilage Risk Detected</h2>
    <p><strong>Product Name:</strong> ${escapeHtml(input.productName)}</p>
    <p><strong>Current Room:</strong> ${escapeHtml(input.currentRoomName)}</p>
    <p><strong>Current Temperature:</strong> ${input.currentTemperature.toFixed(1)}°C</p>
    <p><strong>Current Humidity:</strong> ${input.currentHumidity.toFixed(1)}%</p>
    <p><strong>Safe Temperature Range:</strong> ${escapeHtml(input.safeTempRange)}</p>
    <p><strong>Safe Humidity Range:</strong> ${escapeHtml(input.safeHumidityRange)}</p>
    <p><strong>Problem:</strong> ${escapeHtml(input.problem)}</p>
    <p><strong>Risk Explanation:</strong> ${escapeHtml(input.riskExplanation)}</p>
    <p><strong>Recommendation:</strong> ${escapeHtml(input.recommendation)}</p>
    <p><strong>Action Taken:</strong> ${escapeHtml(input.actionTaken)}</p>
    <p><strong>Timestamp:</strong> ${escapeHtml(new Date(input.timestampIso).toLocaleString())}</p>
  `;

  await transporter.sendMail({
    from: `FoodSafe Monitor <${gmailUser}>`,
    to: input.to,
    subject,
    text,
    html,
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
