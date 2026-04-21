import { getSupabaseAdminClient } from "@/backend/services/supabase-admin.service";
import { sendSpoilageRiskEmail } from "@/backend/services/spoilage-alert-email.service";

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

export type SpoilageMonitorResult = {
  evaluatedRooms: number;
  affectedRooms: number;
  evaluatedProducts: number;
  movedProducts: number;
  unresolvedProducts: number;
  alertsSent: number;
};

export async function runSpoilagePrevention(userId: string): Promise<SpoilageMonitorResult> {
  const supabase = getSupabaseAdminClient();

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
    throw new Error(userError.message);
  }
  if (roomsError) {
    throw new Error(roomsError.message);
  }
  if (weatherError) {
    throw new Error(weatherError.message);
  }

  const allRooms = rooms ?? [];
  if (allRooms.length === 0) {
    return emptyResult();
  }

  const latestWeather = weather?.[0];
  const currentTemp = latestWeather?.temperature;
  const currentHumidity = latestWeather?.humidity;

  if (currentTemp === null || currentTemp === undefined || currentHumidity === null || currentHumidity === undefined) {
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

  for (const room of allRooms) {
    const roomUnsafe = isOutOfRange({
      temp: currentTemp,
      humidity: currentHumidity,
      minTemp: room.ideal_temperature_min,
      maxTemp: room.ideal_temperature_max,
      minHumidity: room.ideal_humidity_min,
      maxHumidity: room.ideal_humidity_max,
    });

    if (!roomUnsafe) {
      continue;
    }

    affectedRooms += 1;
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

      await sendSpoilageRiskEmail({
        to: user?.email ?? process.env.GMAIL_USER ?? "",
        productName: product.name,
        currentRoomName: room.name,
        currentTemperature: currentTemp,
        currentHumidity,
        safeTempRange: `${minTemp.toFixed(1)}°C - ${maxTemp.toFixed(1)}°C`,
        safeHumidityRange: `${minHumidity.toFixed(1)}% - ${maxHumidity.toFixed(1)}%`,
        problem: issueSummary.problem,
        riskExplanation: issueSummary.riskExplanation,
        recommendation,
        actionTaken:
          actionTaken.startsWith("AUTO_MOVED")
            ? `Product automatically moved to ${targetRoom?.name}`
            : "No suitable room available",
        timestampIso: new Date().toISOString(),
      });
      alertsSent += 1;
    }
  }

  return {
    evaluatedRooms: allRooms.length,
    affectedRooms,
    evaluatedProducts,
    movedProducts,
    unresolvedProducts,
    alertsSent,
  };
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
