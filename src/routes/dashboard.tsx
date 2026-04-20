import { createFileRoute, redirect } from "@tanstack/react-router";
import * as React from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { getWeatherForLocation, type WeatherSnapshot } from "@/lib/weather.functions";
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

const dashboardViewSchema = z.object({
  view: z.enum(["products", "rooms", "reports"]).optional(),
});

export const Route = createFileRoute("/dashboard")({
  validateSearch: (search) => dashboardViewSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Dashboard — ChillSense" },
      { name: "description", content: "Your ChillSense dashboard." },
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
  const activeView = search.view ?? "reports";

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [weather, setWeather] = React.useState<WeatherState>({
    loading: false,
    error: null,
    data: null,
    coordinates: null,
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
  const [actionMessage, setActionMessage] = React.useState<string>("");
  const [actionError, setActionError] = React.useState<string | null>(null);

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
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to create product.");
    } finally {
      setSavingProduct(false);
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
      async (position) => {
        try {
          const supabase = getSupabaseBrowserClient();
          const {
            data: { session },
          } = await supabase.auth.getSession();

          const latitude = position.coords.latitude;
          const longitude = position.coords.longitude;
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
        } catch (e) {
          setWeather((current) => ({
            ...current,
            loading: false,
            error: e instanceof Error ? e.message : "Failed to fetch weather.",
          }));
        }
      },
      (positionError) => {
        setWeather((current) => ({
          ...current,
          loading: false,
          error:
            positionError.code === positionError.PERMISSION_DENIED
              ? "Location permission denied."
              : positionError.message,
        }));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  }

  const healthyRooms = state.rooms.filter((room) => {
    const latest = state.latestByRoom[room.id];
    if (!latest) return false;

    return (
      Number(latest.temperature) >= Number(room.ideal_temperature_min) &&
      Number(latest.temperature) <= Number(room.ideal_temperature_max) &&
      Number(latest.humidity) >= Number(room.ideal_humidity_min) &&
      Number(latest.humidity) <= Number(room.ideal_humidity_max)
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

  function goToView(view: "products" | "rooms" | "reports") {
    navigate({
      to: "/dashboard",
      search: (prev) => ({ ...prev, view }),
    });
  }

  return (
    <main className="mx-auto max-w-7xl px-4 pb-20 pt-28 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="rounded-3xl border border-border/60 bg-card p-4 shadow-[var(--shadow-soft)] lg:sticky lg:top-24 lg:h-fit">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-brand">Dashboard</p>
          <nav className="space-y-1">
            <button
              type="button"
              onClick={() => goToView("products")}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                activeView === "products"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              Products
            </button>
            <button
              type="button"
              onClick={() => goToView("rooms")}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                activeView === "rooms"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              Storage Rooms
            </button>
            <button
              type="button"
              onClick={() => goToView("reports")}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                activeView === "reports"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              Reports
            </button>
          </nav>
        </aside>

        <div>
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">Dashboard</h1>
              <p className="mt-2 text-muted-foreground">
                Monitor your food storage conditions in real-time.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={loadWeatherFromLocation}
                className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                {weather.loading ? "Getting location…" : "Refresh location weather"}
              </button>
              <button
                onClick={loadDashboard}
                className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                Refresh
              </button>
            </div>
          </div>

          {error ? (
            <p className="mb-6 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
          ) : null}

          {actionError ? (
            <p className="mb-6 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {actionError}
            </p>
          ) : null}

          {actionMessage ? (
            <p className="mb-6 rounded-md bg-safe/15 p-3 text-sm text-foreground">{actionMessage}</p>
          ) : null}

          {activeView === "products" ? (
            <section id="products" className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-[var(--shadow-soft)]">
              <h2 className="text-lg font-semibold text-foreground">Products</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Create products to monitor and assign them to a storage room.
              </p>
              <form onSubmit={createProduct} className="mt-4 space-y-3">
                <div className="space-y-2">
                  <label htmlFor="product-name" className="text-sm font-medium text-foreground">
                    Product name
                  </label>
                  <input
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
                  <input
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
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-60"
                >
                  {savingProduct ? "Saving…" : "Create product"}
                </button>
              </form>
            </div>

            <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-[var(--shadow-soft)]">
              <h2 className="text-lg font-semibold text-foreground">Product list</h2>
              {state.products.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">No products found.</p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {state.products.map((product) => (
                    <li key={product.id} className="rounded-lg border border-border/60 px-3 py-2 text-sm">
                      <p className="font-medium text-foreground">{product.name}</p>
                      <p className="text-muted-foreground">
                        {product.category ?? "Uncategorized"} · Qty {product.quantity} · Room {roomNameById.get(product.storage_room_id) ?? "—"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            </section>
          ) : null}

          {activeView === "rooms" ? (
            <section id="storage-rooms" className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-[var(--shadow-soft)]">
              <h2 className="text-lg font-semibold text-foreground">Storage Rooms</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Create rooms and configure ideal thresholds for monitoring.
              </p>
              <form onSubmit={createStorageRoom} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <label htmlFor="room-name" className="text-sm font-medium text-foreground">
                    Room name
                  </label>
                  <input
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
                  <input
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
                  <input
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
                  <input
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
                  <input
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
                  <input
                    id="room-humidity-max"
                    type="number"
                    step="0.1"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    value={roomForm.ideal_humidity_max}
                    onChange={(e) => setRoomForm((s) => ({ ...s, ideal_humidity_max: e.target.value }))}
                  />
                </div>
                <button
                  type="submit"
                  disabled={savingRoom}
                  className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-accent sm:col-span-2 disabled:opacity-60"
                >
                  {savingRoom ? "Saving…" : "Create room"}
                </button>
              </form>
            </div>

            <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-[var(--shadow-soft)]">
              <h2 className="text-lg font-semibold text-foreground">Rooms</h2>
              {state.rooms.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  No storage rooms found yet. Add rooms to start receiving live readings.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {state.rooms.map((room) => {
                    const latest = state.latestByRoom[room.id];
                    const inTempRange =
                      latest &&
                      Number(latest.temperature) >= Number(room.ideal_temperature_min) &&
                      Number(latest.temperature) <= Number(room.ideal_temperature_max);
                    const inHumidityRange =
                      latest &&
                      Number(latest.humidity) >= Number(room.ideal_humidity_min) &&
                      Number(latest.humidity) <= Number(room.ideal_humidity_max);
                    const inRange = !!(inTempRange && inHumidityRange);

                    return (
                      <li
                        key={room.id}
                        className="rounded-xl border border-border/60 bg-background/50 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-foreground">{room.name}</p>
                            <p className="text-xs text-muted-foreground">{room.location ?? "No location"}</p>
                          </div>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              inRange
                                ? "bg-emerald-500/10 text-emerald-600"
                                : "bg-amber-500/10 text-amber-600"
                            }`}
                          >
                            {latest ? (inRange ? "In range" : "Out of range") : "No readings"}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                          <p className="text-muted-foreground">
                            Temp: {latest ? `${Number(latest.temperature).toFixed(1)}°C` : "—"}
                          </p>
                          <p className="text-muted-foreground">
                            Humidity: {latest ? `${Number(latest.humidity).toFixed(1)}%` : "—"}
                          </p>
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
            <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-[var(--shadow-soft)]">
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

            <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-[var(--shadow-soft)]">
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
              value={state.avgTemperature !== null ? `${state.avgTemperature}°C` : "—"}
              sub="Latest readings"
            />
            <MetricCard
              label="Average humidity"
              value={state.avgHumidity !== null ? `${state.avgHumidity}%` : "—"}
              sub="Latest readings"
            />
            <MetricCard
              label="Active alerts"
              value={String(state.activeAlerts)}
              sub={`${state.criticalAlerts} critical/danger`}
            />
              </section>

              <section className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-[var(--shadow-soft)]">
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

            <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-[var(--shadow-soft)]">
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

            <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-[var(--shadow-soft)]">
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

            <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-[var(--shadow-soft)]">
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
            <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-[var(--shadow-soft)]">
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
        </div>
      </div>
    </main>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-[var(--shadow-soft)]">
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
