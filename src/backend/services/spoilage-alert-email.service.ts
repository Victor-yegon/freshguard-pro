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

export type SpoilageAlertDigestItem = {
  productName: string;
  currentRoomName: string;
  currentTemperature: number;
  currentHumidity: number;
  safeTempRange: string;
  safeHumidityRange: string;
  problem: string;
  actionTaken: string;
};

function getMailConfig() {
  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");

  if (!gmailUser || !gmailAppPassword) {
    throw new Error(
      `Email delivery is not configured. Missing Gmail credentials on server. User: ${gmailUser ? "set" : "missing"}, Password: ${gmailAppPassword ? "set" : "missing"}`,
    );
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: gmailUser,
      pass: gmailAppPassword,
    },
  });

  return { gmailUser, transporter };
}

export async function sendSpoilageRiskEmail(input: SpoilageAlertEmailInput) {
  const { gmailUser, transporter } = getMailConfig();

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

  try {
    const info = await transporter.sendMail({
      from: `FoodSafe Monitor <${gmailUser}>`,
      to: input.to,
      subject,
      text,
      html,
    });
    console.log(`Email sent successfully to ${input.to}. Response ID: ${info.response}`);
    return info;
  } catch (error) {
    console.error(`Failed to send email to ${input.to}:`, error);
    throw error;
  }
}

export async function sendSpoilageRiskDigestEmail(input: {
  to: string;
  timestampIso: string;
  items: SpoilageAlertDigestItem[];
}) {
  if (input.items.length === 0) {
    return;
  }

  const { gmailUser, transporter } = getMailConfig();
  const subject = `🚨 Food Spoilage Risk Digest (${input.items.length} alert${input.items.length === 1 ? "" : "s"})`;

  const textLines: string[] = [
    "Food Spoilage Risk Digest",
    "",
    `Detected ${input.items.length} spoilage alert${input.items.length === 1 ? "" : "s"}.`,
    `Timestamp: ${new Date(input.timestampIso).toLocaleString()}`,
    "",
  ];

  for (const [index, item] of input.items.entries()) {
    textLines.push(
      `${index + 1}. ${item.productName} (${item.currentRoomName})`,
      `   Current: ${item.currentTemperature.toFixed(1)}°C, ${item.currentHumidity.toFixed(1)}%`,
      `   Safe Temp: ${item.safeTempRange}`,
      `   Safe Humidity: ${item.safeHumidityRange}`,
      `   Problem: ${item.problem}`,
      `   Action: ${item.actionTaken}`,
      "",
    );
  }

  const htmlItems = input.items
    .map(
      (item, index) => `
      <li style="margin-bottom: 12px;">
        <strong>${index + 1}. ${escapeHtml(item.productName)}</strong>
        <div>Room: ${escapeHtml(item.currentRoomName)}</div>
        <div>Current: ${item.currentTemperature.toFixed(1)}°C, ${item.currentHumidity.toFixed(1)}%</div>
        <div>Safe Temp: ${escapeHtml(item.safeTempRange)}</div>
        <div>Safe Humidity: ${escapeHtml(item.safeHumidityRange)}</div>
        <div>Problem: ${escapeHtml(item.problem)}</div>
        <div>Action: ${escapeHtml(item.actionTaken)}</div>
      </li>
    `,
    )
    .join("");

  const html = `
    <h2>🚨 Food Spoilage Risk Digest</h2>
    <p>Detected <strong>${input.items.length}</strong> spoilage alert${input.items.length === 1 ? "" : "s"}.</p>
    <p><strong>Timestamp:</strong> ${escapeHtml(new Date(input.timestampIso).toLocaleString())}</p>
    <ol>${htmlItems}</ol>
  `;

  try {
    const info = await transporter.sendMail({
      from: `FoodSafe Monitor <${gmailUser}>`,
      to: input.to,
      subject,
      text: textLines.join("\n"),
      html,
    });
    console.log(`Digest email sent successfully to ${input.to}. Response ID: ${info.response}`);
    return info;
  } catch (error) {
    console.error(`Failed to send digest email to ${input.to}:`, error);
    throw error;
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
