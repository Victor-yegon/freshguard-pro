-- =========================
-- 1. USERS
-- =========================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT NOW()
);

-- =========================
-- 1b. ALERT NOTIFICATION SETTINGS
-- =========================
-- Single per-user email used for spoilage/alert notifications.
CREATE TABLE IF NOT EXISTS alert_notification_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(150) NOT NULL,
    last_digest_sent_at TIMESTAMP NULL,
    last_scan_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =========================
-- 2. STORAGE ROOMS
-- =========================
CREATE TABLE IF NOT EXISTS storage_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    location VARCHAR(255),
    ideal_temperature_min DECIMAL(5,2) NOT NULL,
    ideal_temperature_max DECIMAL(5,2) NOT NULL,
    ideal_humidity_min DECIMAL(5,2) NOT NULL,
    ideal_humidity_max DECIMAL(5,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =========================
-- 3. PRODUCTS
-- =========================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storage_room_id UUID REFERENCES storage_rooms(id) ON DELETE SET NULL,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(100),
    quantity INT DEFAULT 1,
    
    -- storage requirements
    min_temp DECIMAL(5,2),
    max_temp DECIMAL(5,2),
    min_humidity DECIMAL(5,2),
    max_humidity DECIMAL(5,2),

    expiry_date DATE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =========================
-- 4. SENSOR READINGS
-- =========================
CREATE TABLE IF NOT EXISTS sensor_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storage_room_id UUID REFERENCES storage_rooms(id) ON DELETE CASCADE,
    
    temperature DECIMAL(5,2) NOT NULL,
    humidity DECIMAL(5,2) NOT NULL,
    
    source VARCHAR(50) DEFAULT 'REAL', 
    -- REAL | SIMULATION | WEATHER_API

    recorded_at TIMESTAMP DEFAULT NOW()
);

-- =========================
-- 5. ALERTS
-- =========================
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storage_room_id UUID REFERENCES storage_rooms(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,

    severity VARCHAR(20) NOT NULL,
    -- INFO | WARNING | DANGER | CRITICAL

    message TEXT NOT NULL,

    duration_minutes INT DEFAULT 0,

    status VARCHAR(20) DEFAULT 'ACTIVE',
    -- ACTIVE | RESOLVED

    source VARCHAR(50) DEFAULT 'REAL',
    -- REAL | SIMULATION

    created_at TIMESTAMP DEFAULT NOW()
);

-- =========================
-- 6. REPORTS
-- =========================
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storage_room_id UUID REFERENCES storage_rooms(id) ON DELETE CASCADE,

    total_alerts INT DEFAULT 0,
    critical_alerts INT DEFAULT 0,
    warning_alerts INT DEFAULT 0,

    avg_temperature DECIMAL(5,2),
    avg_humidity DECIMAL(5,2),

    generated_at TIMESTAMP DEFAULT NOW()
);

-- =========================
-- 7. WEATHER HISTORY
-- =========================
CREATE TABLE IF NOT EXISTS weather_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    latitude DECIMAL(9,6) NOT NULL,
    longitude DECIMAL(9,6) NOT NULL,
    timezone VARCHAR(100),
    temperature DECIMAL(5,2),
    humidity DECIMAL(5,2),
    wind_speed DECIMAL(6,2),
    weather_code INT,
    recorded_at TIMESTAMP DEFAULT NOW()
);

-- =========================
-- INDEXES (PERFORMANCE OPTIMIZATION)
-- =========================
CREATE INDEX IF NOT EXISTS idx_sensor_room ON sensor_readings(storage_room_id);
CREATE INDEX IF NOT EXISTS idx_alert_room ON alerts(storage_room_id);
CREATE INDEX IF NOT EXISTS idx_product_room ON products(storage_room_id);
CREATE INDEX IF NOT EXISTS idx_alert_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_weather_user_recorded ON weather_history(user_id, recorded_at);

-- =========================
-- FK ALIGNMENT: KEEP PRODUCTS WHEN ROOM IS DELETED
-- =========================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints tc
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name = 'products'
            AND tc.constraint_name = 'products_storage_room_id_fkey'
    ) THEN
        ALTER TABLE products DROP CONSTRAINT products_storage_room_id_fkey;
    END IF;

    ALTER TABLE products
        ADD CONSTRAINT products_storage_room_id_fkey
        FOREIGN KEY (storage_room_id) REFERENCES storage_rooms(id) ON DELETE SET NULL;
END $$;

-- =========================
-- RLS POLICIES (SUPABASE)
-- =========================
-- Run these in Supabase SQL Editor if RLS is enabled and inserts/selects are blocked.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_select_own ON users;
CREATE POLICY users_select_own ON users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS users_insert_own ON users;
CREATE POLICY users_insert_own ON users
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS users_update_own ON users;
CREATE POLICY users_update_own ON users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

ALTER TABLE alert_notification_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alert_notification_settings_select_own ON alert_notification_settings;
CREATE POLICY alert_notification_settings_select_own ON alert_notification_settings
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS alert_notification_settings_upsert_own ON alert_notification_settings;
CREATE POLICY alert_notification_settings_upsert_own ON alert_notification_settings
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS alert_notification_settings_update_own ON alert_notification_settings;
CREATE POLICY alert_notification_settings_update_own ON alert_notification_settings
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

ALTER TABLE storage_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS storage_rooms_select_own ON storage_rooms;
CREATE POLICY storage_rooms_select_own ON storage_rooms
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS storage_rooms_insert_own ON storage_rooms;
CREATE POLICY storage_rooms_insert_own ON storage_rooms
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS storage_rooms_update_own ON storage_rooms;
CREATE POLICY storage_rooms_update_own ON storage_rooms
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS storage_rooms_delete_own ON storage_rooms;
CREATE POLICY storage_rooms_delete_own ON storage_rooms
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS products_select_own ON products;
CREATE POLICY products_select_own ON products
FOR SELECT
TO authenticated
USING (
    storage_room_id IS NULL
    OR EXISTS (
        SELECT 1
        FROM storage_rooms
        WHERE storage_rooms.id = products.storage_room_id
            AND storage_rooms.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS products_insert_own ON products;
CREATE POLICY products_insert_own ON products
FOR INSERT
TO authenticated
WITH CHECK (
    storage_room_id IS NULL
    OR EXISTS (
        SELECT 1
        FROM storage_rooms
        WHERE storage_rooms.id = products.storage_room_id
            AND storage_rooms.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS products_update_own ON products;
CREATE POLICY products_update_own ON products
FOR UPDATE
TO authenticated
USING (
    storage_room_id IS NULL
    OR EXISTS (
        SELECT 1
        FROM storage_rooms
        WHERE storage_rooms.id = products.storage_room_id
            AND storage_rooms.user_id = auth.uid()
    )
)
WITH CHECK (
    storage_room_id IS NULL
    OR EXISTS (
        SELECT 1
        FROM storage_rooms
        WHERE storage_rooms.id = products.storage_room_id
            AND storage_rooms.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS products_delete_own ON products;
CREATE POLICY products_delete_own ON products
FOR DELETE
TO authenticated
USING (
    storage_room_id IS NULL
    OR EXISTS (
        SELECT 1
        FROM storage_rooms
        WHERE storage_rooms.id = products.storage_room_id
            AND storage_rooms.user_id = auth.uid()
    )
);

ALTER TABLE sensor_readings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sensor_readings_select_own ON sensor_readings;
CREATE POLICY sensor_readings_select_own ON sensor_readings
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM storage_rooms
        WHERE storage_rooms.id = sensor_readings.storage_room_id
            AND storage_rooms.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS sensor_readings_insert_own ON sensor_readings;
CREATE POLICY sensor_readings_insert_own ON sensor_readings
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM storage_rooms
        WHERE storage_rooms.id = sensor_readings.storage_room_id
            AND storage_rooms.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS sensor_readings_update_own ON sensor_readings;
CREATE POLICY sensor_readings_update_own ON sensor_readings
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM storage_rooms
        WHERE storage_rooms.id = sensor_readings.storage_room_id
            AND storage_rooms.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM storage_rooms
        WHERE storage_rooms.id = sensor_readings.storage_room_id
            AND storage_rooms.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS sensor_readings_delete_own ON sensor_readings;
CREATE POLICY sensor_readings_delete_own ON sensor_readings
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM storage_rooms
        WHERE storage_rooms.id = sensor_readings.storage_room_id
            AND storage_rooms.user_id = auth.uid()
    )
);

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alerts_select_own ON alerts;
CREATE POLICY alerts_select_own ON alerts
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM storage_rooms
        WHERE storage_rooms.id = alerts.storage_room_id
            AND storage_rooms.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS alerts_insert_own ON alerts;
CREATE POLICY alerts_insert_own ON alerts
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM storage_rooms
        WHERE storage_rooms.id = alerts.storage_room_id
            AND storage_rooms.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS alerts_update_own ON alerts;
CREATE POLICY alerts_update_own ON alerts
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM storage_rooms
        WHERE storage_rooms.id = alerts.storage_room_id
            AND storage_rooms.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM storage_rooms
        WHERE storage_rooms.id = alerts.storage_room_id
            AND storage_rooms.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS alerts_delete_own ON alerts;
CREATE POLICY alerts_delete_own ON alerts
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM storage_rooms
        WHERE storage_rooms.id = alerts.storage_room_id
            AND storage_rooms.user_id = auth.uid()
    )
);

ALTER TABLE weather_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS weather_history_select_own ON weather_history;
CREATE POLICY weather_history_select_own ON weather_history
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS weather_history_insert_own ON weather_history;
CREATE POLICY weather_history_insert_own ON weather_history
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS weather_history_update_own ON weather_history;
CREATE POLICY weather_history_update_own ON weather_history
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS weather_history_delete_own ON weather_history;
CREATE POLICY weather_history_delete_own ON weather_history
FOR DELETE
TO authenticated
USING (user_id = auth.uid());
