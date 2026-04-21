import { createFileRoute, redirect } from "@tanstack/react-router";
import * as React from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { getWeatherForLocation, type WeatherSnapshot } from "@/lib/weather.functions";
import { runSpoilagePreventionScan } from "@/lib/spoilage.functions";
import { z } from "zod";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MainLayout } from "@/components/layouts/MainLayout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";

type RoomRow = {
  id: string;
  name: string;
  location: string | null;
  ideal_temperature_min: number;
  ideal_temperature_max: number;
  ideal_humidity_min: number;
  ideal_humidity_max: number;
};

type ReadingRow = {
  id: string;
  storage_room_id: string;
  temperature: number;
  humidity: number;
  recorded_at: string;
};

type AlertRow = {
  id: string;
  severity: string;
  status: string;
  created_at: string;
};

type ProductRow = {
  id: string;
  storage_room_id: string;
  name: string;
  category: string | null;
  quantity: number;
};

type DashboardState = {
  rooms: RoomRow[];
  products: ProductRow[];
  latestByRoom: Record<string, ReadingRow | undefined>;
  recentReadings: ReadingRow[];
  activeAlerts: number;
  criticalAlerts: number;
  avgTemperature: number | null;
  avgHumidity: number | null;
  productCategoryDistribution: Array<{ category: string; count: number }>;
};

const WEATHER_CODE_LABELS: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  71: "Slight snow fall",
  73: "Moderate snow fall",
  75: "Heavy snow fall",
  80: "Rain showers",
  81: "Heavy rain showers",
  82: "Violent rain showers",
  95: "Thunderstorm",
};

type WeatherState = {
  loading: boolean;
  error: string | null;
  data: WeatherSnapshot | null;
  coordinates: { latitude: number; longitude: number } | null;
  locationName: string | null;
};

type WeatherHistoryPoint = {
  time: string;
  temperature: number | null;
  humidity: number | null;
};

type WeatherHistoryRow = {
  recorded_at: string;
  temperature: number | null;
  humidity: number | null;
};

type GeolocationSuccessDetail = {
  latitude: number;
  longitude: number;
};

type GeolocationErrorDetail = {
  code: number;
  message: string;
};

const WEATHER_LOCATION_SUCCESS_EVENT = "freshguard:weather-location-success";
const WEATHER_LOCATION_ERROR_EVENT = "freshguard:weather-location-error";

const dashboardViewSchema = z.object({
  view: z.enum(["overview", "products", "rooms", "reports", "notifications"]).optional(),
});

export const Route = createFileRoute("/dashboard")({
  validateSearch: (search) => dashboardViewSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Dashboard — FoodSafe Monitor" },
      { name: "description", content: "Your FoodSafe Monitor dashboard." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") {
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({
        to: "/login",
        search: {
          redirect: "/dashboard",
        },
      });
    }
  },
  component: DashboardPage,
});

function DashboardPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const activeView = search.view ?? "overview";

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [weather, setWeather] = React.useState<WeatherState>({
    loading: false,
    error: null,
    data: null,
    coordinates: null,
    locationName: null,
  });
  const [weatherHistory, setWeatherHistory] = React.useState<WeatherHistoryPoint[]>([]);
  const [state, setState] = React.useState<DashboardState>({
    rooms: [],
    products: [],
    latestByRoom: {},
    recentReadings: [],
    activeAlerts: 0,
    criticalAlerts: 0,
    avgTemperature: null,
    avgHumidity: null,
    productCategoryDistribution: [],
  });
  const [roomForm, setRoomForm] = React.useState({
    name: "",
    location: "",
    ideal_temperature_min: "2",
    ideal_temperature_max: "6",
    ideal_humidity_min: "50",
    ideal_humidity_max: "70",
  });
  const [productForm, setProductForm] = React.useState({
    name: "",
    category: "Dairy",
    quantity: "1",
    storage_room_id: "",
  });
  const [savingRoom, setSavingRoom] = React.useState(false);
  const [savingProduct, setSavingProduct] = React.useState(false);
  const [editingRoomId, setEditingRoomId] = React.useState<string | null>(null);
  const [updatingRoomId, setUpdatingRoomId] = React.useState<string | null>(null);
  const [deletingRoomId, setDeletingRoomId] = React.useState<string | null>(null);
  const [assigningProductRoomId, setAssigningProductRoomId] = React.useState<string | null>(null);
  const [existingProductByRoom, setExistingProductByRoom] = React.useState<Record<string, string>>({});
  const [moveTargetRoomIdByRoom, setMoveTargetRoomIdByRoom] = React.useState<Record<string, string>>({});
  const [roomEditForm, setRoomEditForm] = React.useState({
    name: "",
    location: "",
    ideal_temperature_min: "2",
    ideal_temperature_max: "6",
    ideal_humidity_min: "50",
    ideal_humidity_max: "70",
  });
  const [actionMessage, setActionMessage] = React.useState<string>("");
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [notificationEmail, setNotificationEmail] = React.useState<string>("");
  const [notificationEmailStatus, setNotificationEmailStatus] = React.useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [loadingNotificationEmail, setLoadingNotificationEmail] = React.useState(false);
  const [savingNotificationEmail, setSavingNotificationEmail] = React.useState(false);
  const scanInProgressRef = React.useRef(false);

  const triggerSpoilageScan = React.useCallback(async () => {
    if (scanInProgressRef.current) {
      return;
    }

    scanInProgressRef.current = true;
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user.id) {
        return;
      }

      await runSpoilagePreventionScan({ data: { userId: session.user.id } });
    } catch (scanError) {
      console.error("[Dashboard] Spoilage scan failed:", scanError);
    } finally {
      scanInProgressRef.current = false;
    }
  }, []);

  const loadDashboard = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user.id) {
        setError("No active session found.");
        setLoading(false);
        return;
      }

      const roomsResult = await supabase
        .from("storage_rooms")
        .select(
          "id, name, location, ideal_temperature_min, ideal_temperature_max, ideal_humidity_min, ideal_humidity_max",
        )
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: true });

      if (roomsResult.error) {
        throw new Error(roomsResult.error.message);
      }

      const rooms = (roomsResult.data ?? []) as RoomRow[];
      const weatherHistoryResult = await supabase
        .from("weather_history")
        .select("recorded_at, temperature, humidity")
        .eq("user_id", session.user.id)
        .order("recorded_at", { ascending: true })
        .limit(120);

      if (weatherHistoryResult.error) {
        throw new Error(weatherHistoryResult.error.message);
      }

      const persistedWeather = (weatherHistoryResult.data ?? []) as WeatherHistoryRow[];
      setWeatherHistory(
        persistedWeather.map((entry) => ({
          time: entry.recorded_at,
          temperature: entry.temperature,
          humidity: entry.humidity,
        })),
      );

      const roomIds = rooms.map((room) => room.id);

      if (roomIds.length === 0) {
        setState({
          rooms: [],
          products: [],
          latestByRoom: {},
          recentReadings: [],
          activeAlerts: 0,
          criticalAlerts: 0,
          avgTemperature: null,
          avgHumidity: null,
          productCategoryDistribution: [],
        });
        setLoading(false);
        return;
      }

      const [readingsResult, alertsResult, productsResult] = await Promise.all([
        supabase
          .from("sensor_readings")
          .select("id, storage_room_id, temperature, humidity, recorded_at")
          .in("storage_room_id", roomIds)
          .order("recorded_at", { ascending: false })
          .limit(250),
        supabase
          .from("alerts")
          .select("id, severity, status, created_at")
          .in("storage_room_id", roomIds)
          .order("created_at", { ascending: false })
          .limit(250),
        supabase
          .from("products")
          .select("id, storage_room_id, name, category, quantity")
          .in("storage_room_id", roomIds),
      ]);

      if (readingsResult.error) {
        throw new Error(readingsResult.error.message);
      }

      if (alertsResult.error) {
        throw new Error(alertsResult.error.message);
      }

      if (productsResult.error) {
        throw new Error(productsResult.error.message);
      }

      const readings = (readingsResult.data ?? []) as ReadingRow[];
      const alerts = (alertsResult.data ?? []) as AlertRow[];
      const products = (productsResult.data ?? []) as ProductRow[];

      const latestByRoom: Record<string, ReadingRow | undefined> = {};
      for (const reading of readings) {
        if (!latestByRoom[reading.storage_room_id]) {
          latestByRoom[reading.storage_room_id] = reading;
        }
      }

      const latestReadings = Object.values(latestByRoom).filter(
        (reading): reading is ReadingRow => !!reading,
      );

      const avgTemperature =
        latestReadings.length > 0
          ? Number(
              (
                latestReadings.reduce((sum, reading) => sum + Number(reading.temperature), 0) /
                latestReadings.length
              ).toFixed(1),
            )
          : null;

      const avgHumidity =
        latestReadings.length > 0
          ? Number(
              (
                latestReadings.reduce((sum, reading) => sum + Number(reading.humidity), 0) /
                latestReadings.length
              ).toFixed(1),
            )
          : null;

      const activeAlerts = alerts.filter((alert) => alert.status?.toUpperCase() === "ACTIVE").length;
      const criticalAlerts = alerts.filter((alert) => {
        const status = alert.status?.toUpperCase();
        const severity = alert.severity?.toUpperCase();
        return status === "ACTIVE" && (severity === "CRITICAL" || severity === "DANGER");
      }).length;

      const recentReadings = [...readings]
        .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
        .slice(-12);

      const productCategoryMap = new Map<string, number>();
      for (const product of products) {
        const key = product.category?.trim() || "Uncategorized";
        productCategoryMap.set(key, (productCategoryMap.get(key) ?? 0) + 1);
      }

      const productCategoryDistribution = Array.from(productCategoryMap.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count);

      setState({
        rooms,
        products,
        latestByRoom,
        recentReadings,
        activeAlerts,
        criticalAlerts,
        avgTemperature,
        avgHumidity,
        productCategoryDistribution,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadDashboard();
    loadWeatherFromLocation();
  }, [loadDashboard]);

  React.useEffect(() => {
    let active = true;

    async function loadSettings() {
      setLoadingNotificationEmail(true);
      setNotificationEmailStatus(null);

      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!active) return;
        if (!session?.user.id) {
          setNotificationEmail("");
          return;
        }

        const { data, error: settingsError } = await supabase
          .from("alert_notification_settings")
          .select("email")
          .eq("user_id", session.user.id)
          .maybeSingle<{ email: string }>();

        if (!active) return;
        if (settingsError) {
          throw new Error(settingsError.message);
        }

        setNotificationEmail(data?.email ?? session.user.email ?? "");
      } catch (e) {
        if (!active) return;
        setNotificationEmailStatus({
          ok: false,
          message: e instanceof Error ? e.message : "Failed to load notification settings.",
        });
      } finally {
        if (!active) return;
        setLoadingNotificationEmail(false);
      }
    }

    loadSettings();
    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    async function handleLocationSuccess(event: Event) {
      const customEvent = event as CustomEvent<GeolocationSuccessDetail>;
      const { latitude, longitude } = customEvent.detail;

      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const snapshot = await getWeatherForLocation({ data: { latitude, longitude } });

        if (session?.user.id) {
          const persistResult = await supabase.from("weather_history").insert({
            user_id: session.user.id,
            latitude,
            longitude,
            timezone: snapshot.timezone,
            temperature: snapshot.current.temperature_2m,
            humidity: snapshot.current.relative_humidity_2m,
            wind_speed: snapshot.current.wind_speed_10m,
            weather_code: snapshot.current.weather_code,
            recorded_at: snapshot.current.time,
          });

          if (persistResult.error) {
            throw new Error(persistResult.error.message);
          }
        }

        setWeather({
          loading: false,
          error: null,
          data: snapshot,
          coordinates: { latitude, longitude },
          locationName: snapshot.locationName,
        });

        setWeatherHistory((current) => {
          const nextPoint: WeatherHistoryPoint = {
            time: snapshot.current.time,
            temperature: snapshot.current.temperature_2m,
            humidity: snapshot.current.relative_humidity_2m,
          };

          const next = [...current, nextPoint];
          return next.slice(-24);
        });

        if (session?.user.id) {
          triggerSpoilageScan();
        }
      } catch (e) {
        setWeather((current) => ({
          ...current,
          loading: false,
          error: e instanceof Error ? e.message : "Failed to fetch weather.",
        }));
      }
    }

    function handleLocationError(event: Event) {
      const customEvent = event as CustomEvent<GeolocationErrorDetail>;
      const { code, message } = customEvent.detail;

      setWeather((current) => ({
        ...current,
        loading: false,
        error: code === 1 ? "Location permission denied." : message,
      }));
    }

    window.addEventListener(
      WEATHER_LOCATION_SUCCESS_EVENT,
      handleLocationSuccess as EventListener,
    );
    window.addEventListener(WEATHER_LOCATION_ERROR_EVENT, handleLocationError as EventListener);

    return () => {
      window.removeEventListener(
        WEATHER_LOCATION_SUCCESS_EVENT,
        handleLocationSuccess as EventListener,
      );
      window.removeEventListener(WEATHER_LOCATION_ERROR_EVENT, handleLocationError as EventListener);
    };
  }, [triggerSpoilageScan]);

  React.useEffect(() => {
    const intervalId = window.setInterval(() => {
      triggerSpoilageScan();
    }, 2 * 60 * 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [triggerSpoilageScan]);

  async function createStorageRoom(e: React.FormEvent) {
    e.preventDefault();
    setSavingRoom(true);
    setActionError(null);
    setActionMessage("");

    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user.id) {
        throw new Error("Please login again.");
      }

      const result = await supabase.from("storage_rooms").insert({
        user_id: session.user.id,
        name: roomForm.name.trim(),
        location: roomForm.location.trim() || null,
        ideal_temperature_min: Number(roomForm.ideal_temperature_min),
        ideal_temperature_max: Number(roomForm.ideal_temperature_max),
        ideal_humidity_min: Number(roomForm.ideal_humidity_min),
        ideal_humidity_max: Number(roomForm.ideal_humidity_max),
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      setActionMessage("Storage room created.");
      setRoomForm((current) => ({ ...current, name: "", location: "" }));
      await loadDashboard();
      await triggerSpoilageScan();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to create storage room.");
    } finally {
      setSavingRoom(false);
    }
  }

  async function createProduct(e: React.FormEvent) {
    e.preventDefault();
    setSavingProduct(true);
    setActionError(null);
    setActionMessage("");

    try {
      if (!productForm.storage_room_id) {
        throw new Error("Select a storage room for this product.");
      }

      const supabase = getSupabaseBrowserClient();
      const result = await supabase.from("products").insert({
        storage_room_id: productForm.storage_room_id,
        name: productForm.name.trim(),
        category: productForm.category,
        quantity: Number(productForm.quantity) || 1,
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      setActionMessage("Product created.");
      setProductForm((current) => ({ ...current, name: "", quantity: "1" }));
      await loadDashboard();
      await triggerSpoilageScan();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to create product.");
    } finally {
      setSavingProduct(false);
    }
  }

  function beginEditRoom(room: RoomRow) {
    setEditingRoomId(room.id);
    setRoomEditForm({
      name: room.name,
      location: room.location ?? "",
      ideal_temperature_min: String(room.ideal_temperature_min),
      ideal_temperature_max: String(room.ideal_temperature_max),
      ideal_humidity_min: String(room.ideal_humidity_min),
      ideal_humidity_max: String(room.ideal_humidity_max),
    });
  }

  async function saveRoomEdit(roomId: string) {
    setUpdatingRoomId(roomId);
    setActionError(null);
    setActionMessage("");

    try {
      const supabase = getSupabaseBrowserClient();
      const result = await supabase
        .from("storage_rooms")
        .update({
          name: roomEditForm.name.trim(),
          location: roomEditForm.location.trim() || null,
          ideal_temperature_min: Number(roomEditForm.ideal_temperature_min),
          ideal_temperature_max: Number(roomEditForm.ideal_temperature_max),
          ideal_humidity_min: Number(roomEditForm.ideal_humidity_min),
          ideal_humidity_max: Number(roomEditForm.ideal_humidity_max),
        })
        .eq("id", roomId);

      if (result.error) {
        throw new Error(result.error.message);
      }

      setActionMessage("Room updated.");
      setEditingRoomId(null);
      await loadDashboard();
      await triggerSpoilageScan();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to update room.");
    } finally {
      setUpdatingRoomId(null);
    }
  }

  async function assignExistingProductToRoom(roomId: string) {
    setAssigningProductRoomId(roomId);
    setActionError(null);
    setActionMessage("");

    try {
      const selectedProductId = existingProductByRoom[roomId];
      if (!selectedProductId) {
        throw new Error("Select an existing product first.");
      }

      const supabase = getSupabaseBrowserClient();
      const result = await supabase
        .from("products")
        .update({ storage_room_id: roomId })
        .eq("id", selectedProductId);

      if (result.error) {
        throw new Error(result.error.message);
      }

      setActionMessage("Product assigned to room.");
      setExistingProductByRoom((current) => ({ ...current, [roomId]: "" }));
      await loadDashboard();
      await triggerSpoilageScan();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to assign product to room.");
    } finally {
      setAssigningProductRoomId(null);
    }
  }

  async function deleteRoom(roomId: string) {
    setDeletingRoomId(roomId);
    setActionError(null);
    setActionMessage("");

    try {
      const supabase = getSupabaseBrowserClient();
      const productsInRoom = state.products.filter((product) => product.storage_room_id === roomId);
      const otherRooms = state.rooms.filter((room) => room.id !== roomId);

      if (productsInRoom.length > 0) {
        if (otherRooms.length === 0) {
          throw new Error(
            "Cannot delete this room because it contains products and no other room exists to move them to.",
          );
        }

        const targetRoomId = moveTargetRoomIdByRoom[roomId] || otherRooms[0].id;
        const moveResult = await supabase
          .from("products")
          .update({ storage_room_id: targetRoomId })
          .eq("storage_room_id", roomId);

        if (moveResult.error) {
          throw new Error(moveResult.error.message);
        }
      }

      const deleteResult = await supabase.from("storage_rooms").delete().eq("id", roomId);

      if (deleteResult.error) {
        throw new Error(deleteResult.error.message);
      }

      setActionMessage(
        productsInRoom.length > 0
          ? "Room deleted and products were moved safely."
          : "Room deleted.",
      );
      if (editingRoomId === roomId) {
        setEditingRoomId(null);
      }
      await loadDashboard();
      await triggerSpoilageScan();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to delete room.");
    } finally {
      setDeletingRoomId(null);
    }
  }

  async function loadWeatherFromLocation() {
    setWeather((current) => ({ ...current, loading: true, error: null }));

    if (!navigator.geolocation) {
      setWeather((current) => ({
        ...current,
        loading: false,
        error: "Geolocation is not supported by this browser.",
      }));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        window.dispatchEvent(
          new CustomEvent<GeolocationSuccessDetail>(WEATHER_LOCATION_SUCCESS_EVENT, {
            detail: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            },
          }),
        );
      },
      (positionError) => {
        window.dispatchEvent(
          new CustomEvent<GeolocationErrorDetail>(WEATHER_LOCATION_ERROR_EVENT, {
            detail: {
              code: positionError.code,
              message: positionError.message,
            },
          }),
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  }

  const latestWeatherHistory =
    weatherHistory.length > 0 ? weatherHistory[weatherHistory.length - 1] : null;

  const roomCurrentTemperature =
    weather.data?.current.temperature_2m ?? latestWeatherHistory?.temperature ?? null;
  const roomCurrentHumidity =
    weather.data?.current.relative_humidity_2m ?? latestWeatherHistory?.humidity ?? null;

  const summaryTemperature =
    state.avgTemperature !== null
      ? state.avgTemperature
      : weather.data?.current.temperature_2m ?? latestWeatherHistory?.temperature ?? null;
  const summaryHumidity =
    state.avgHumidity !== null
      ? state.avgHumidity
      : weather.data?.current.relative_humidity_2m ?? latestWeatherHistory?.humidity ?? null;

  const healthyRooms = state.rooms.filter((room) => {
    if (roomCurrentTemperature === null || roomCurrentHumidity === null) return false;

    return (
      Number(roomCurrentTemperature) <= Number(room.ideal_temperature_max) &&
      Number(roomCurrentHumidity) <= Number(room.ideal_humidity_max)
    );
  }).length;

  const temperatureTrendData = weatherHistory.map((entry) => ({
    time: formatTimeLabel(entry.time),
    temperature: entry.temperature,
  }));

  const humidityTrendData = weatherHistory.map((entry) => ({
    time: formatTimeLabel(entry.time),
    humidity: entry.humidity,
  }));

  const spoilageRiskData = React.useMemo(() => {
    let safe = 0;
    let warning = 0;
    let critical = 0;

    for (const room of state.rooms) {
      const reading = state.latestByRoom[room.id];

      if (!reading) {
        warning += 1;
        continue;
      }

      const tempDeviation = getRangeDeviation(
        Number(reading.temperature),
        Number(room.ideal_temperature_min),
        Number(room.ideal_temperature_max),
      );
      const humidityDeviation = getRangeDeviation(
        Number(reading.humidity),
        Number(room.ideal_humidity_min),
        Number(room.ideal_humidity_max),
      );

      if (tempDeviation === 0 && humidityDeviation === 0) {
        safe += 1;
      } else if (tempDeviation > 2 || humidityDeviation > 10) {
        critical += 1;
      } else {
        warning += 1;
      }
    }

    return [
      { name: "Safe", value: safe },
      { name: "Warning", value: warning },
      { name: "Critical", value: critical },
    ];
  }, [state.latestByRoom, state.rooms]);

  const outsideTemperature = weather.data?.current.temperature_2m ?? null;
  const isOutsideTemperatureHigh = outsideTemperature !== null && outsideTemperature >= 30;
  const roomNameById = new Map(state.rooms.map((room) => [room.id, room.name]));
  const productCountByRoom = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of state.products) {
      counts.set(product.storage_room_id, (counts.get(product.storage_room_id) ?? 0) + 1);
    }
    return counts;
  }, [state.products]);

  const resolvedLocationLabel =
    weather.locationName ||
    (weather.data?.timezone
      ? weather.data.timezone.split("/").pop()?.replace(/_/g, " ") ?? null
      : null);

  const summaryTemperatureSub =
    state.avgTemperature !== null
      ? "Latest room readings"
      : weather.data?.current.temperature_2m !== null && weather.data?.current.temperature_2m !== undefined
        ? "From current location weather"
        : latestWeatherHistory?.temperature !== null && latestWeatherHistory?.temperature !== undefined
          ? "From recent weather history"
        : "No readings yet";
  const summaryHumiditySub =
    state.avgHumidity !== null
      ? "Latest room readings"
      : weather.data?.current.relative_humidity_2m !== null &&
          weather.data?.current.relative_humidity_2m !== undefined
        ? "From current location weather"
        : latestWeatherHistory?.humidity !== null && latestWeatherHistory?.humidity !== undefined
          ? "From recent weather history"
        : "No readings yet";

  function goToView(view: "overview" | "products" | "rooms" | "reports" | "notifications") {
    navigate({
      to: "/dashboard",
      search: (prev) => ({ ...prev, view }),
    });
  }

  return (
    <MainLayout
      title="Dashboard"
      subtitle="Monitor your food storage conditions in real-time."
      sidebarContent={
        <>
          <div className="space-y-1">
            <p className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Overview
            </p>
            <Button
              type="button"
              size="sm"
              variant={activeView === "overview" ? "default" : "secondary"}
              className="w-full cursor-pointer justify-start rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-md"
              onClick={() => goToView("overview")}
            >
              Overview
            </Button>
          </div>

          <div className="space-y-1">
            <p className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Views
            </p>
            <Button
              type="button"
              size="sm"
              variant={activeView === "reports" ? "default" : "secondary"}
              className="w-full cursor-pointer justify-start rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-md"
              onClick={() => goToView("reports")}
            >
              Reports
            </Button>
            <Button
              type="button"
              size="sm"
              variant={activeView === "rooms" ? "default" : "secondary"}
              className="w-full cursor-pointer justify-start rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-md"
              onClick={() => goToView("rooms")}
            >
              Storage Rooms
            </Button>
            <Button
              type="button"
              size="sm"
              variant={activeView === "products" ? "default" : "secondary"}
              className="w-full cursor-pointer justify-start rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-md"
              onClick={() => goToView("products")}
            >
              Products
            </Button>
            <Button
              type="button"
              size="sm"
              variant={activeView === "notifications" ? "default" : "secondary"}
              className="w-full cursor-pointer justify-start rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-md"
              onClick={() => goToView("notifications")}
            >
              Notification email
            </Button>
          </div>

          <div className="space-y-2">
            <p className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Actions
            </p>
            <Button
              type="button"
              variant="outline"
              className="w-full cursor-pointer justify-start rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-md"
              onClick={loadWeatherFromLocation}
            >
              {weather.loading ? "Getting location…" : "Refresh location weather"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full cursor-pointer justify-start rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-md"
              onClick={loadDashboard}
            >
              Refresh
            </Button>
          </div>
        </>
      }
    >
      {error ? (
        <Alert variant="destructive" className="mb-6 rounded-2xl">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {actionError ? (
        <Alert variant="destructive" className="mb-6 rounded-2xl">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}

      {actionMessage ? (
        <Alert className="mb-6 rounded-2xl border-safe/30 bg-safe/10 text-foreground">
          <AlertDescription>{actionMessage}</AlertDescription>
        </Alert>
      ) : null}

          {activeView === "overview" ? (
            <section className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-md">
            <h2 className="text-lg font-semibold text-foreground">Current location</h2>
            {weather.loading ? (
              <p className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-safe">
                <Loader2 className="h-4 w-4 animate-spin" />
                Detecting your current location…
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                {resolvedLocationLabel ?? "Location unavailable"}
              </p>
            )}
            {weather.error ? (
              <p className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {weather.error}
              </p>
            ) : null}
            {weather.data ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <WeatherStat
                  label="Temperature"
                  value={formatTemperature(weather.data.current.temperature_2m)}
                />
                <WeatherStat
                  label="Humidity"
                  value={formatHumidity(weather.data.current.relative_humidity_2m)}
                />
                <WeatherStat label="Wind speed" value={formatWind(weather.data.current.wind_speed_10m)} />
                <WeatherStat
                  label="Condition"
                  value={formatWeatherCode(weather.data.current.weather_code)}
                />
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Location request is sent automatically to fetch local weather from Open-Meteo.
              </p>
            )}
            {weather.coordinates ? (
              <p className="mt-4 text-xs text-muted-foreground">
                Coordinates: {weather.coordinates.latitude.toFixed(4)}, {weather.coordinates.longitude.toFixed(4)}
              </p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-md">
            <h2 className="text-lg font-semibold text-foreground">Status summary</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Monitoring highlights for rooms, humidity, and alert activity.
            </p>
            {isOutsideTemperatureHigh ? (
              <p className="mt-4 rounded-md bg-warning/20 p-3 text-sm text-warning-foreground">
                High outside temperature may increase spoilage risk.
              </p>
            ) : null}
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <MetricCard
                label="Storage rooms"
                value={String(state.rooms.length)}
                sub={loading ? "Loading…" : `${healthyRooms} in range`}
              />
              <MetricCard
                label="Active alerts"
                value={String(state.activeAlerts)}
                sub={`${state.criticalAlerts} critical/danger`}
              />
              <MetricCard
                label="Average temperature"
                value={summaryTemperature !== null ? `${summaryTemperature.toFixed(1)}°C` : "—"}
                sub={summaryTemperatureSub}
              />
              <MetricCard
                label="Average humidity"
                value={summaryHumidity !== null ? `${summaryHumidity.toFixed(1)}%` : "—"}
                sub={summaryHumiditySub}
              />
            </div>
          </div>
            </section>
          ) : null}

          {activeView === "notifications" ? (
            <section id="notifications" className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-md">
                <h2 className="text-lg font-semibold text-foreground">Alert notification email</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Alerts and auto-move actions are emailed to this address.
                </p>

                {notificationEmailStatus ? (
                  <Alert
                    className={`mt-4 rounded-2xl ${
                      notificationEmailStatus.ok
                        ? "border-safe/30 bg-safe/10 text-foreground"
                        : "border-destructive/30 bg-destructive/10 text-destructive"
                    }`}
                  >
                    <AlertDescription>{notificationEmailStatus.message}</AlertDescription>
                  </Alert>
                ) : null}

                <form
                  className="mt-4 space-y-3"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setSavingNotificationEmail(true);
                    setNotificationEmailStatus(null);

                    try {
                      const parsedEmail = z.string().trim().email().parse(notificationEmail);
                      const supabase = getSupabaseBrowserClient();
                      const {
                        data: { session },
                      } = await supabase.auth.getSession();

                      if (!session?.user.id) {
                        throw new Error("Please login again.");
                      }

                      const { error: upsertError } = await supabase
                        .from("alert_notification_settings")
                        .upsert({
                          user_id: session.user.id,
                          email: parsedEmail,
                          updated_at: new Date().toISOString(),
                        });

                      if (upsertError) {
                        throw new Error(upsertError.message);
                      }

                      setNotificationEmail(parsedEmail);
                      setNotificationEmailStatus({ ok: true, message: "Notification email saved." });
                    } catch (err) {
                      setNotificationEmailStatus({
                        ok: false,
                        message: err instanceof Error ? err.message : "Failed to save notification email.",
                      });
                    } finally {
                      setSavingNotificationEmail(false);
                    }
                  }}
                >
                  <div className="space-y-2">
                    <label htmlFor="notification-email" className="text-sm font-medium text-foreground">
                      Email address
                    </label>
                    <Input
                      id="notification-email"
                      type="email"
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                      placeholder="alerts@company.com"
                      value={notificationEmail}
                      disabled={loadingNotificationEmail || savingNotificationEmail}
                      onChange={(e) => setNotificationEmail(e.target.value)}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="rounded-xl"
                    disabled={loadingNotificationEmail || savingNotificationEmail}
                  >
                    {savingNotificationEmail ? "Saving..." : "Save email"}
                  </Button>
                </form>
              </div>

              <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-md">
                <h2 className="text-lg font-semibold text-foreground">How alerts work</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  When temperature or humidity falls outside a room’s safe range, the system evaluates each product,
                  tries to auto-relocate it to a safer room, and emails the result.
                </p>
                <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                  <p>1. Detect unsafe temperature/humidity.</p>
                  <p>2. Identify affected products.</p>
                  <p>3. Auto-move if a safe room exists.</p>
                  <p>4. Create an alert and send an email.</p>
                </div>
              </div>
            </section>
          ) : null}

          {activeView === "products" ? (
            <section id="products" className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-md">
              <h2 className="text-lg font-semibold text-foreground">Products</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Create products to monitor and assign them to a storage room.
              </p>
              <form onSubmit={createProduct} className="mt-4 space-y-3">
                <div className="space-y-2">
                  <label htmlFor="product-name" className="text-sm font-medium text-foreground">
                    Product name
                  </label>
                  <Input
                    id="product-name"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Product name"
                    required
                    value={productForm.name}
                    onChange={(e) => setProductForm((s) => ({ ...s, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="product-category" className="text-sm font-medium text-foreground">
                    Category
                  </label>
                  <select
                    id="product-category"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    value={productForm.category}
                    onChange={(e) => setProductForm((s) => ({ ...s, category: e.target.value }))}
                  >
                    <option>Dairy</option>
                    <option>Meat</option>
                    <option>Fruits</option>
                    <option>Vegetables</option>
                    <option>Dry Goods</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="product-quantity" className="text-sm font-medium text-foreground">
                    Quantity
                  </label>
                  <Input
                    id="product-quantity"
                    type="number"
                    min={1}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    value={productForm.quantity}
                    onChange={(e) => setProductForm((s) => ({ ...s, quantity: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="product-room" className="text-sm font-medium text-foreground">
                    Storage room
                  </label>
                  <select
                    id="product-room"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    value={productForm.storage_room_id}
                    onChange={(e) => setProductForm((s) => ({ ...s, storage_room_id: e.target.value }))}
                    required
                  >
                    <option value="">Select storage room</option>
                    {state.rooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  type="submit"
                  disabled={savingProduct}
                  className="rounded-xl"
                >
                  {savingProduct ? "Saving…" : "Create product"}
                </Button>
              </form>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-md">
              <h2 className="text-lg font-semibold text-foreground">Product list</h2>
              {state.products.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">No products found.</p>
              ) : (
                <div className="mt-4 rounded-xl border border-border/60">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Room currently in</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {state.products.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium text-foreground">{product.name}</TableCell>
                          <TableCell>{product.category ?? "Uncategorized"}</TableCell>
                          <TableCell>{product.quantity}</TableCell>
                          <TableCell>{roomNameById.get(product.storage_room_id) ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
            </section>
          ) : null}

          {activeView === "rooms" ? (
            <section id="storage-rooms" className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-md">
              <h2 className="text-lg font-semibold text-foreground">Storage Rooms</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Create rooms and configure ideal thresholds for monitoring.
              </p>
              <form onSubmit={createStorageRoom} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <label htmlFor="room-name" className="text-sm font-medium text-foreground">
                    Room name
                  </label>
                  <Input
                    id="room-name"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Room name"
                    required
                    value={roomForm.name}
                    onChange={(e) => setRoomForm((s) => ({ ...s, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <label htmlFor="room-location" className="text-sm font-medium text-foreground">
                    Location
                  </label>
                  <Input
                    id="room-location"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Location"
                    value={roomForm.location}
                    onChange={(e) => setRoomForm((s) => ({ ...s, location: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="room-temp-min" className="text-sm font-medium text-foreground">
                    Ideal temperature min (°C)
                  </label>
                  <Input
                    id="room-temp-min"
                    type="number"
                    step="0.1"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    value={roomForm.ideal_temperature_min}
                    onChange={(e) =>
                      setRoomForm((s) => ({ ...s, ideal_temperature_min: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="room-temp-max" className="text-sm font-medium text-foreground">
                    Ideal temperature max (°C)
                  </label>
                  <Input
                    id="room-temp-max"
                    type="number"
                    step="0.1"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    value={roomForm.ideal_temperature_max}
                    onChange={(e) =>
                      setRoomForm((s) => ({ ...s, ideal_temperature_max: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="room-humidity-min" className="text-sm font-medium text-foreground">
                    Ideal humidity min (%)
                  </label>
                  <Input
                    id="room-humidity-min"
                    type="number"
                    step="0.1"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    value={roomForm.ideal_humidity_min}
                    onChange={(e) => setRoomForm((s) => ({ ...s, ideal_humidity_min: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="room-humidity-max" className="text-sm font-medium text-foreground">
                    Ideal humidity max (%)
                  </label>
                  <Input
                    id="room-humidity-max"
                    type="number"
                    step="0.1"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    value={roomForm.ideal_humidity_max}
                    onChange={(e) => setRoomForm((s) => ({ ...s, ideal_humidity_max: e.target.value }))}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={savingRoom}
                  className="rounded-xl sm:col-span-2"
                >
                  {savingRoom ? "Saving…" : "Create room"}
                </Button>
              </form>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-md">
              <h2 className="text-lg font-semibold text-foreground">Rooms</h2>
              {state.rooms.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  No storage rooms found yet. Add rooms to start receiving live readings.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {state.rooms.map((room) => {
                    const tempAboveMax =
                      roomCurrentTemperature !== null &&
                      Number(roomCurrentTemperature) > Number(room.ideal_temperature_max);
                    const humidityAboveMax =
                      roomCurrentHumidity !== null &&
                      Number(roomCurrentHumidity) > Number(room.ideal_humidity_max);
                    const outOfRange = tempAboveMax || humidityAboveMax;

                    return (
                      <li
                        key={room.id}
                        className="rounded-xl border border-border/60 bg-background/50 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-foreground">{room.name}</p>
                            <p className="text-xs text-muted-foreground">{room.location ?? "No location"}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {productCountByRoom.get(room.id) ?? 0} product(s)
                            </p>
                          </div>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              !outOfRange
                                ? "bg-safe/15 text-safe"
                                : "bg-destructive/15 text-destructive"
                            }`}
                          >
                            {roomCurrentTemperature !== null && roomCurrentHumidity !== null
                              ? !outOfRange
                                ? "In range"
                                : "Out of range"
                              : "No weather data"}
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="rounded-lg"
                            onClick={() => beginEditRoom(room)}
                          >
                            Edit room
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            className="rounded-lg"
                            disabled={deletingRoomId === room.id}
                            onClick={() => deleteRoom(room.id)}
                          >
                            {deletingRoomId === room.id ? "Deleting…" : "Delete room"}
                          </Button>
                        </div>

                        <div className="mt-3 space-y-2">
                          <label className="text-xs font-medium text-muted-foreground">
                            Add existing product to this room
                          </label>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <select
                              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                              value={existingProductByRoom[room.id] ?? ""}
                              onChange={(e) =>
                                setExistingProductByRoom((current) => ({
                                  ...current,
                                  [room.id]: e.target.value,
                                }))
                              }
                            >
                              <option value="">Select existing product</option>
                              {state.products
                                .filter((product) => product.storage_room_id !== room.id)
                                .map((product) => (
                                  <option key={product.id} value={product.id}>
                                    {product.name} ({roomNameById.get(product.storage_room_id) ?? "Unassigned"})
                                  </option>
                                ))}
                            </select>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="rounded-lg"
                              disabled={assigningProductRoomId === room.id}
                              onClick={() => assignExistingProductToRoom(room.id)}
                            >
                              {assigningProductRoomId === room.id ? "Assigning…" : "Assign"}
                            </Button>
                          </div>
                        </div>

                        {(productCountByRoom.get(room.id) ?? 0) > 0 && state.rooms.length > 1 ? (
                          <div className="mt-3 space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">
                              Move products to room before deleting
                            </label>
                            <select
                              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                              value={moveTargetRoomIdByRoom[room.id] ?? ""}
                              onChange={(e) =>
                                setMoveTargetRoomIdByRoom((current) => ({
                                  ...current,
                                  [room.id]: e.target.value,
                                }))
                              }
                            >
                              <option value="">Auto select another room</option>
                              {state.rooms
                                .filter((targetRoom) => targetRoom.id !== room.id)
                                .map((targetRoom) => (
                                  <option key={targetRoom.id} value={targetRoom.id}>
                                    {targetRoom.name}
                                  </option>
                                ))}
                            </select>
                          </div>
                        ) : null}

                        {editingRoomId === room.id ? (
                          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <Input
                              value={roomEditForm.name}
                              onChange={(e) =>
                                setRoomEditForm((current) => ({ ...current, name: e.target.value }))
                              }
                              placeholder="Room name"
                            />
                            <Input
                              value={roomEditForm.location}
                              onChange={(e) =>
                                setRoomEditForm((current) => ({ ...current, location: e.target.value }))
                              }
                              placeholder="Location"
                            />
                            <Input
                              type="number"
                              step="0.1"
                              value={roomEditForm.ideal_temperature_min}
                              onChange={(e) =>
                                setRoomEditForm((current) => ({
                                  ...current,
                                  ideal_temperature_min: e.target.value,
                                }))
                              }
                              placeholder="Temp min"
                            />
                            <Input
                              type="number"
                              step="0.1"
                              value={roomEditForm.ideal_temperature_max}
                              onChange={(e) =>
                                setRoomEditForm((current) => ({
                                  ...current,
                                  ideal_temperature_max: e.target.value,
                                }))
                              }
                              placeholder="Temp max"
                            />
                            <Input
                              type="number"
                              step="0.1"
                              value={roomEditForm.ideal_humidity_min}
                              onChange={(e) =>
                                setRoomEditForm((current) => ({
                                  ...current,
                                  ideal_humidity_min: e.target.value,
                                }))
                              }
                              placeholder="Humidity min"
                            />
                            <Input
                              type="number"
                              step="0.1"
                              value={roomEditForm.ideal_humidity_max}
                              onChange={(e) =>
                                setRoomEditForm((current) => ({
                                  ...current,
                                  ideal_humidity_max: e.target.value,
                                }))
                              }
                              placeholder="Humidity max"
                            />
                            <div className="sm:col-span-2 flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                className="rounded-lg"
                                disabled={updatingRoomId === room.id}
                                onClick={() => saveRoomEdit(room.id)}
                              >
                                {updatingRoomId === room.id ? "Saving…" : "Save changes"}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="rounded-lg"
                                onClick={() => setEditingRoomId(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : null}

                        <div className="mt-4 rounded-xl border border-border/60 bg-card p-3">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Current conditions
                          </p>
                          {roomCurrentTemperature !== null && roomCurrentHumidity !== null ? (
                            <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                              <p className="text-foreground">{Number(roomCurrentTemperature).toFixed(1)}°C</p>
                              <p className="text-foreground">{Number(roomCurrentHumidity).toFixed(1)}%</p>
                            </div>
                          ) : (
                            <p className="mt-2 text-sm text-muted-foreground">No current weather data yet.</p>
                          )}
                          <p className="mt-2 text-xs text-muted-foreground">Source: Open-Meteo</p>

                          <div className="mt-3 border-t border-border/60 pt-3">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Configured safe range
                            </p>
                            <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-2 sm:gap-3">
                              <p>
                                Temperature: {Number(room.ideal_temperature_min).toFixed(1)}°C -{" "}
                                {Number(room.ideal_temperature_max).toFixed(1)}°C
                              </p>
                              <p>
                                Humidity: {Number(room.ideal_humidity_min).toFixed(1)}% -{" "}
                                {Number(room.ideal_humidity_max).toFixed(1)}%
                              </p>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            </section>
          ) : null}

          {activeView === "reports" ? (
            <>
              <section id="reports" className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-md">
              <h2 className="text-lg font-semibold text-foreground">Weather near you</h2>
              {weather.error ? (
                <p className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {weather.error}
                </p>
              ) : null}
              {weather.data ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <WeatherStat label="Temperature" value={formatTemperature(weather.data.current.temperature_2m)} />
                  <WeatherStat label="Humidity" value={formatHumidity(weather.data.current.relative_humidity_2m)} />
                  <WeatherStat label="Wind speed" value={formatWind(weather.data.current.wind_speed_10m)} />
                  <WeatherStat
                    label="Condition"
                    value={formatWeatherCode(weather.data.current.weather_code)}
                  />
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  Location request is sent automatically to fetch local weather from Open-Meteo.
                </p>
              )}
              {weather.coordinates ? (
                <p className="mt-4 text-xs text-muted-foreground">
                  Coordinates: {weather.coordinates.latitude.toFixed(4)}, {weather.coordinates.longitude.toFixed(4)}
                </p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-md">
              <h2 className="text-lg font-semibold text-foreground">Weather sync</h2>
              <p className="mt-4 text-sm text-muted-foreground">
                Your browser gets the location, sends latitude/longitude to the server, and the server
                fetches weather from Open-Meteo before returning it here.
              </p>
              <p className="mt-3 text-sm text-muted-foreground">Timezone: {weather.data?.timezone ?? "—"}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Observation time: {weather.data?.current.time ? new Date(weather.data.current.time).toLocaleString() : "—"}
              </p>
              {isOutsideTemperatureHigh ? (
                <p className="mt-4 rounded-md bg-warning/20 p-3 text-sm text-warning-foreground">
                  High outside temperature may increase spoilage risk.
                </p>
              ) : null}
            </div>
              </section>

              <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Storage rooms"
              value={String(state.rooms.length)}
              sub={loading ? "Loading…" : `${healthyRooms} in range`}
            />
            <MetricCard
              label="Average temperature"
              value={summaryTemperature !== null ? `${summaryTemperature.toFixed(1)}°C` : "—"}
              sub={summaryTemperatureSub}
            />
            <MetricCard
              label="Average humidity"
              value={summaryHumidity !== null ? `${summaryHumidity.toFixed(1)}%` : "—"}
              sub={summaryHumiditySub}
            />
            <MetricCard
              label="Active alerts"
              value={String(state.activeAlerts)}
              sub={`${state.criticalAlerts} critical/danger`}
            />
              </section>

              <section className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-md">
              <h2 className="text-lg font-semibold text-foreground">Temperature trend</h2>
              {temperatureTrendData.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Fetch weather using your location to build temperature history.
                </p>
              ) : (
                <div className="mt-4 h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={temperatureTrendData}>
                      <CartesianGrid stroke="var(--color-border)" strokeDasharray="4 4" />
                      <XAxis dataKey="time" stroke="var(--color-muted-foreground)" />
                      <YAxis stroke="var(--color-muted-foreground)" />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="temperature"
                        name="Temperature"
                        stroke="var(--color-chart-1)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-md">
              <h2 className="text-lg font-semibold text-foreground">Humidity trend</h2>
              {humidityTrendData.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Fetch weather using your location to build humidity history.
                </p>
              ) : (
                <div className="mt-4 h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={humidityTrendData}>
                      <CartesianGrid stroke="var(--color-border)" strokeDasharray="4 4" />
                      <XAxis dataKey="time" stroke="var(--color-muted-foreground)" />
                      <YAxis stroke="var(--color-muted-foreground)" />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="humidity"
                        name="Humidity"
                        stroke="var(--color-chart-2)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-md">
              <h2 className="text-lg font-semibold text-foreground">Product categories</h2>
              {state.productCategoryDistribution.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">No product category data available.</p>
              ) : (
                <div className="mt-4 h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={state.productCategoryDistribution}>
                      <CartesianGrid stroke="var(--color-border)" strokeDasharray="4 4" />
                      <XAxis dataKey="category" stroke="var(--color-muted-foreground)" />
                      <YAxis allowDecimals={false} stroke="var(--color-muted-foreground)" />
                      <Tooltip />
                      <Bar dataKey="count" name="Products" fill="var(--color-chart-3)" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-md">
              <h2 className="text-lg font-semibold text-foreground">Spoilage risk</h2>
              {state.rooms.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">No monitoring data available yet.</p>
              ) : (
                <div className="mt-4 h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={spoilageRiskData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        innerRadius={45}
                      >
                        {spoilageRiskData.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={
                              entry.name === "Safe"
                                ? "var(--color-safe)"
                                : entry.name === "Warning"
                                  ? "var(--color-warning)"
                                  : "var(--color-critical)"
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
              </section>

              <section className="mt-8">
            <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-md">
              <h2 className="text-lg font-semibold text-foreground">Recent readings</h2>
              {state.recentReadings.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">No recent readings available.</p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {state.recentReadings.map((reading) => (
                    <li
                      key={reading.id}
                      className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm"
                    >
                      <span className="text-muted-foreground">
                        {new Date(reading.recorded_at).toLocaleString()}
                      </span>
                      <span className="font-medium text-foreground">
                        {Number(reading.temperature).toFixed(1)}°C · {Number(reading.humidity).toFixed(1)}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
              </section>
            </>
          ) : null}
    </MainLayout>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-md">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function WeatherStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function formatTemperature(value: number | null) {
  return value === null ? "—" : `${value.toFixed(1)}°C`;
}

function formatHumidity(value: number | null) {
  return value === null ? "—" : `${value.toFixed(0)}%`;
}

function formatWind(value: number | null) {
  return value === null ? "—" : `${value.toFixed(1)} km/h`;
}

function formatWeatherCode(value: number | null) {
  if (value === null) return "—";
  return WEATHER_CODE_LABELS[value] ?? `Code ${value}`;
}

function formatTimeLabel(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getRangeDeviation(value: number, min: number, max: number) {
  if (value < min) return min - value;
  if (value > max) return value - max;
  return 0;
}
