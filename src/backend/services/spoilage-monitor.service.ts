import { getSupabaseAdminClient } from "@/backend/services/supabase-admin.service";
import {
  sendSpoilageRiskDigestEmail,
  type SpoilageAlertDigestItem,
} from "@/backend/services/spoilage-alert-email.service";

type StorageRoom = {
  id: string;
  user_id: string;
  name: string;
  ideal_temperature_min: number;
  ideal_temperature_max: number;
  ideal_humidity_min: number;
  ideal_humidity_max: number;
};

type Product = {
  id: string;
  storage_room_id: string;
  name: string;
  min_temp: number | null;
  max_temp: number | null;
  min_humidity: number | null;
  max_humidity: number | null;
};

type WeatherHistory = {
  temperature: number | null;
  humidity: number | null;
  recorded_at: string;
};

type User = {
  id: string;
  email: string;
};

type NotificationSetting = {
  email: string;
};

type ExistingActiveAlert = {
  id: string;
  product_id: string | null;
  created_at: string;
};

type AlertInsert = {
  storage_room_id: string;
  product_id: string | null;
  severity: "INFO" | "WARNING" | "DANGER" | "CRITICAL";
  message: string;
  duration_minutes: number;
  status: "ACTIVE" | "RESOLVED";
  source: "REAL" | "SIMULATION";
};

export type SpoilageMonitorResult = {
  evaluatedRooms: number;
  affectedRooms: number;
  evaluatedProducts: number;
  movedProducts: number;
  unresolvedProducts: number;
  alertsSent: number;
};

const ALERT_REMINDER_COOLDOWN_MINUTES = 30;

export async function runSpoilagePrevention(userId: string): Promise<SpoilageMonitorResult> {
  const supabase = getSupabaseAdminClient();
  console.log(`[Spoilage Monitor] Starting scan for user: ${userId}`);

  const [{ data: user, error: userError }, { data: rooms, error: roomsError }, { data: weather, error: weatherError }] =
    await Promise.all([
      supabase.from("users").select("id, email").eq("id", userId).single<User>(),
      supabase
        .from("storage_rooms")
        .select(
          "id, user_id, name, ideal_temperature_min, ideal_temperature_max, ideal_humidity_min, ideal_humidity_max",
        )
        .eq("user_id", userId)
        .returns<StorageRoom[]>(),
      supabase
        .from("weather_history")
        .select("temperature, humidity, recorded_at")
        .eq("user_id", userId)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .returns<WeatherHistory[]>(),
    ]);

  if (userError) {
    console.error(`[Spoilage Monitor] User fetch error:`, userError);
    throw new Error(`Failed to fetch user: ${userError.message}`);
  }
  if (roomsError) {
    console.error(`[Spoilage Monitor] Rooms fetch error:`, roomsError);
    throw new Error(`Failed to fetch storage rooms: ${roomsError.message}`);
  }
  if (weatherError) {
    console.error(`[Spoilage Monitor] Weather fetch error:`, weatherError);
    throw new Error(`Failed to fetch weather history: ${weatherError.message}`);
  }

  const allRooms = rooms ?? [];
  console.log(`[Spoilage Monitor] Found ${allRooms.length} rooms for user`);
  if (allRooms.length === 0) {
    console.log(`[Spoilage Monitor] No rooms found, skipping scan`);
    return emptyResult();
  }

  let notificationEmail = user?.email ?? process.env.GMAIL_USER ?? "";
  const { data: notificationSetting, error: notificationSettingError } = await supabase
    .from("alert_notification_settings")
    .select("email")
    .eq("user_id", userId)
    .maybeSingle<NotificationSetting>();

  if (!notificationSettingError && notificationSetting?.email) {
    notificationEmail = notificationSetting.email;
    console.log(`[Spoilage Monitor] Using custom notification email: ${notificationEmail}`);
  } else {
    console.log(`[Spoilage Monitor] Using fallback email: ${notificationEmail}`);
  }

  const latestWeather = weather?.[0];
  const currentTemp = latestWeather?.temperature;
  const currentHumidity = latestWeather?.humidity;

  console.log(`[Spoilage Monitor] Current conditions - Temp: ${currentTemp}°C, Humidity: ${currentHumidity}%`);

  if (currentTemp === null || currentTemp === undefined || currentHumidity === null || currentHumidity === undefined) {
    console.log(`[Spoilage Monitor] No weather data available, skipping scan`);
    return emptyResult();
  }

  const roomIds = allRooms.map((room) => room.id);
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, storage_room_id, name, min_temp, max_temp, min_humidity, max_humidity")
    .in("storage_room_id", roomIds)
    .returns<Product[]>();

  if (productsError) {
    throw new Error(productsError.message);
  }

  let affectedRooms = 0;
  let evaluatedProducts = 0;
  let movedProducts = 0;
  let unresolvedProducts = 0;
  let alertsSent = 0;
  const digestItems: SpoilageAlertDigestItem[] = [];

  const productIds = (products ?? []).map((product) => product.id);
  const existingActiveAlertByProductId = new Map<string, ExistingActiveAlert>();
  if (productIds.length > 0) {
    const { data: existingActiveAlerts, error: existingActiveAlertsError } = await supabase
      .from("alerts")
      .select("id, product_id, created_at")
      .in("product_id", productIds)
      .eq("status", "ACTIVE")
      .eq("source", "SIMULATION")
      .order("created_at", { ascending: false })
      .returns<ExistingActiveAlert[]>();

    if (existingActiveAlertsError) {
      throw new Error(existingActiveAlertsError.message);
    }

    for (const alert of existingActiveAlerts ?? []) {
      if (alert.product_id && !existingActiveAlertByProductId.has(alert.product_id)) {
        existingActiveAlertByProductId.set(alert.product_id, alert);
      }
    }
  }

  for (const room of allRooms) {
    const roomUnsafe = isOutOfRange({
      temp: currentTemp,
      humidity: currentHumidity,
      minTemp: room.ideal_temperature_min,
      maxTemp: room.ideal_temperature_max,
      minHumidity: room.ideal_humidity_min,
      maxHumidity: room.ideal_humidity_max,
    });

    if (roomUnsafe) {
      affectedRooms += 1;
    }

    const productsInRoom = (products ?? []).filter((product) => product.storage_room_id === room.id);

    for (const product of productsInRoom) {
      evaluatedProducts += 1;

      const minTemp = product.min_temp ?? room.ideal_temperature_min;
      const maxTemp = product.max_temp ?? room.ideal_temperature_max;
      const minHumidity = product.min_humidity ?? room.ideal_humidity_min;
      const maxHumidity = product.max_humidity ?? room.ideal_humidity_max;

      const productUnsafe = isOutOfRange({
        temp: currentTemp,
        humidity: currentHumidity,
        minTemp,
        maxTemp,
        minHumidity,
        maxHumidity,
      });

      if (!productUnsafe) {
        const existingActiveAlert = existingActiveAlertByProductId.get(product.id);
        if (existingActiveAlert) {
          const resolveResult = await supabase
            .from("alerts")
            .update({ status: "RESOLVED" })
            .eq("id", existingActiveAlert.id);

          if (resolveResult.error) {
            throw new Error(resolveResult.error.message);
          }

          existingActiveAlertByProductId.delete(product.id);
        }
        continue;
      }

      const issueSummary = explainProblem({
        temp: currentTemp,
        humidity: currentHumidity,
        minTemp,
        maxTemp,
        minHumidity,
        maxHumidity,
      });

      const targetRoom = allRooms.find((candidateRoom) => {
        if (candidateRoom.id === room.id) {
          return false;
        }

        return (
          candidateRoom.ideal_temperature_min <= minTemp &&
          candidateRoom.ideal_temperature_max >= maxTemp &&
          candidateRoom.ideal_humidity_min <= minHumidity &&
          candidateRoom.ideal_humidity_max >= maxHumidity
        );
      });

      let actionTaken = "NO_SAFE_ROOM";
      let recommendation =
        "Move this product to a room with stricter temperature/humidity alignment or manually intervene immediately.";

      if (targetRoom) {
        const moveResult = await supabase
          .from("products")
          .update({ storage_room_id: targetRoom.id })
          .eq("id", product.id);

        if (moveResult.error) {
          throw new Error(moveResult.error.message);
        }

        movedProducts += 1;
        actionTaken = `AUTO_MOVED to ${targetRoom.name}`;
        recommendation = `Product was moved automatically to ${targetRoom.name}.`;
      } else {
        unresolvedProducts += 1;
      }

      const severity = getAlertSeverity({
        temp: currentTemp,
        humidity: currentHumidity,
        minTemp,
        maxTemp,
        minHumidity,
        maxHumidity,
      });
      const alertStatus: AlertInsert["status"] = actionTaken.startsWith("AUTO_MOVED") ? "RESOLVED" : "ACTIVE";

      const existingActiveAlert = existingActiveAlertByProductId.get(product.id);
      if (existingActiveAlert && alertStatus === "ACTIVE") {
        const minutesSinceLastAlert = minutesBetween(existingActiveAlert.created_at, new Date().toISOString());
        if (minutesSinceLastAlert < ALERT_REMINDER_COOLDOWN_MINUTES) {
          continue;
        }
      }

      if (existingActiveAlert && alertStatus === "RESOLVED") {
        const resolveResult = await supabase
          .from("alerts")
          .update({ status: "RESOLVED" })
          .eq("id", existingActiveAlert.id);

        if (resolveResult.error) {
          throw new Error(resolveResult.error.message);
        }

        existingActiveAlertByProductId.delete(product.id);
      }

      const safeRangeLabel = `Temp ${minTemp.toFixed(1)}\u00B0C-${maxTemp.toFixed(1)}\u00B0C, Humidity ${minHumidity.toFixed(1)}%-${maxHumidity.toFixed(1)}%`;
      const alertMessage = [
        `Food spoilage risk detected for ${product.name}.`,
        `Room: ${room.name}.`,
        `Current: ${currentTemp.toFixed(1)}\u00B0C, ${currentHumidity.toFixed(1)}%.`,
        `Safe range: ${safeRangeLabel}.`,
        `Problem: ${issueSummary.problem}.`,
        actionTaken.startsWith("AUTO_MOVED")
          ? `Action taken: Product automatically moved to ${targetRoom?.name}.`
          : "Action taken: No suitable room available.",
      ].join(" ");

      const { error: alertInsertError } = await supabase.from("alerts").insert({
        storage_room_id: room.id,
        product_id: product.id,
        severity,
        message: alertMessage,
        duration_minutes: 0,
        status: alertStatus,
        source: "SIMULATION",
      } satisfies AlertInsert);

      if (alertInsertError) {
        console.error(
          `[Spoilage Monitor] Failed to insert alert for product ${product.name}:`,
          alertInsertError,
        );
        throw new Error(`Failed to create alert: ${alertInsertError.message}`);
      }

      console.log(`[Spoilage Monitor] Alert created for product: ${product.name}`);
      digestItems.push({
        productName: product.name,
        currentRoomName: room.name,
        currentTemperature: currentTemp,
        currentHumidity,
        safeTempRange: `${minTemp.toFixed(1)}\u00B0C - ${maxTemp.toFixed(1)}\u00B0C`,
        safeHumidityRange: `${minHumidity.toFixed(1)}% - ${maxHumidity.toFixed(1)}%`,
        problem: issueSummary.problem,
        actionTaken:
          actionTaken.startsWith("AUTO_MOVED")
            ? `Product automatically moved to ${targetRoom?.name}`
            : "No suitable room available",
      });
      alertsSent += 1;
    }
  }

  if (digestItems.length > 0) {
    try {
      await sendSpoilageRiskDigestEmail({
        to: notificationEmail || user?.email || process.env.GMAIL_USER || "",
        timestampIso: new Date().toISOString(),
        items: digestItems,
      });
    } catch (emailError) {
      console.error(
        `Failed to send spoilage alert digest email to ${notificationEmail}:`,
        emailError,
      );
    }
  }

  const result = {
    evaluatedRooms: allRooms.length,
    affectedRooms,
    evaluatedProducts,
    movedProducts,
    unresolvedProducts,
    alertsSent,
  };

  console.log(`[Spoilage Monitor] Scan complete - Alerts sent: ${alertsSent}, Rooms affected: ${affectedRooms}`);
  return result;
}

function isOutOfRange(params: {
  temp: number;
  humidity: number;
  minTemp: number;
  maxTemp: number;
  minHumidity: number;
  maxHumidity: number;
}) {
  return (
    params.temp < params.minTemp ||
    params.temp > params.maxTemp ||
    params.humidity < params.minHumidity ||
    params.humidity > params.maxHumidity
  );
}

function explainProblem(params: {
  temp: number;
  humidity: number;
  minTemp: number;
  maxTemp: number;
  minHumidity: number;
  maxHumidity: number;
}) {
  const issues: string[] = [];

  if (params.temp < params.minTemp) {
    issues.push("Temperature too low");
  }
  if (params.temp > params.maxTemp) {
    issues.push("Temperature too high");
  }
  if (params.humidity < params.minHumidity) {
    issues.push("Humidity too low");
  }
  if (params.humidity > params.maxHumidity) {
    issues.push("Humidity too high");
  }

  const problem = issues.join(", ");
  const riskExplanation =
    params.temp > params.maxTemp || params.humidity > params.maxHumidity
      ? "High temperature/humidity can accelerate microbial growth and spoilage."
      : "Low temperature/humidity can damage product quality and shelf stability.";

  return { problem, riskExplanation };
}

function getAlertSeverity(params: {
  temp: number;
  humidity: number;
  minTemp: number;
  maxTemp: number;
  minHumidity: number;
  maxHumidity: number;
}): AlertInsert["severity"] {
  const tempDeviation = getRangeDeviation(params.temp, params.minTemp, params.maxTemp);
  const humidityDeviation = getRangeDeviation(params.humidity, params.minHumidity, params.maxHumidity);

  if (tempDeviation > 2 || humidityDeviation > 10) {
    return "CRITICAL";
  }
  if (tempDeviation > 1 || humidityDeviation > 5) {
    return "DANGER";
  }
  return "WARNING";
}

function getRangeDeviation(value: number, min: number, max: number) {
  if (value < min) return min - value;
  if (value > max) return value - max;
  return 0;
}

function minutesBetween(olderIso: string, newerIso: string) {
  const older = new Date(olderIso).getTime();
  const newer = new Date(newerIso).getTime();

  if (!Number.isFinite(older) || !Number.isFinite(newer)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(0, (newer - older) / (1000 * 60));
}

function emptyResult(): SpoilageMonitorResult {
  return {
    evaluatedRooms: 0,
    affectedRooms: 0,
    evaluatedProducts: 0,
    movedProducts: 0,
    unresolvedProducts: 0,
    alertsSent: 0,
  };
}
