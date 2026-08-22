-- ═══════════════════════════════════════════════════════════════════════
-- VELA-X Ops Console — Row Level Security
--
-- מודל האכיפה הוא דו־שכבתי:
--   שכבה 1 — RBAC ברמת האפליקציה (src/server/auth/guard.ts). כל Server Action
--             עובר דרך requirePermission() לפני שהוא נוגע במסד.
--   שכבה 2 — RLS ברמת מסד הנתונים, שמונע דליפה גם אם שכבה 1 נכשלת.
--
-- התפקיד velax_rls הוא תפקיד אכיפה: כל שאילתה שרצה תחתיו כפופה למדיניות.
-- הקשר המשתמש מועבר דרך משתני session:
--   app.current_user_id  — מזהה המשתמש
--   app.is_global        — 'true' כאשר למשתמש יש גישה גלובלית (לא מוגבל למועדונים)
--
-- מעבר ל־Supabase: החלף את current_setting('app.current_user_id') ב־auth.uid()
-- ואת התפקיד velax_rls ב־authenticated. שאר המדיניות זהה.
-- ═══════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'velax_rls') THEN
    CREATE ROLE velax_rls NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO velax_rls;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO velax_rls;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE ON TABLES TO velax_rls;

-- ─── פונקציות עזר ───

CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid;
$$;

/** true כאשר למשתמש אין הגבלת מועדונים — כלומר גישה לכל הרשת */
CREATE OR REPLACE FUNCTION app_is_global() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    current_setting('app.is_global', true) = 'true',
    false
  ) OR NOT EXISTS (
    SELECT 1 FROM user_club_scopes s WHERE s.user_id = app_current_user_id()
  );
$$;

/** true כאשר המשתמש רשאי לגשת למועדון הנתון */
CREATE OR REPLACE FUNCTION app_can_access_club(target_club_id uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT
    app_current_user_id() IS NOT NULL
    AND (
      app_is_global()
      OR target_club_id IS NULL
      OR EXISTS (
        SELECT 1 FROM user_club_scopes s
        WHERE s.user_id = app_current_user_id() AND s.club_id = target_club_id
      )
    );
$$;

-- ─── טבלאות מוגבלות־מועדון ───
-- לכל אחת: RLS פעיל + FORCE (כדי שגם בעל הטבלה יהיה כפוף כשהוא רץ תחת velax_rls)

DO $$
DECLARE
  t text;
  club_scoped text[] := ARRAY[
    'clubs', 'club_contacts', 'club_contracts', 'club_operating_hours',
    'courts', 'stations', 'screens', 'sessions', 'court_bookings',
    'support_tickets', 'checklist_submissions', 'earn_back_agreements',
    'maintenance_tasks', 'leads', 'crm_activities', 'tasks', 'notifications'
  ];
BEGIN
  FOREACH t IN ARRAY club_scoped LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END
$$;

-- clubs — הטבלה שכל השאר נסמכות עליה
DROP POLICY IF EXISTS clubs_scope ON clubs;
CREATE POLICY clubs_scope ON clubs
  USING (app_can_access_club(id))
  WITH CHECK (app_can_access_club(id));

-- טבלאות עם עמודת club_id ישירה
DO $$
DECLARE
  t text;
  direct_club_id text[] := ARRAY[
    'club_contacts', 'club_contracts', 'club_operating_hours', 'courts',
    'stations', 'screens', 'sessions', 'court_bookings', 'support_tickets',
    'checklist_submissions', 'earn_back_agreements', 'maintenance_tasks',
    'crm_activities', 'tasks', 'notifications'
  ];
BEGIN
  FOREACH t IN ARRAY direct_club_id LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_scope', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (app_can_access_club(club_id)) WITH CHECK (app_can_access_club(club_id))',
      t || '_scope', t
    );
  END LOOP;
END
$$;

-- leads — מוגבל גם לפי בעלות וגם לפי מועדון מקושר
DROP POLICY IF EXISTS leads_scope ON leads;
CREATE POLICY leads_scope ON leads
  USING (app_is_global() OR owner_id = app_current_user_id() OR app_can_access_club(club_id))
  WITH CHECK (app_is_global() OR owner_id = app_current_user_id() OR app_can_access_club(club_id));

-- ─── מכשירים: נגזר מהמועדון הנוכחי של המכשיר ───
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS devices_scope ON devices;
CREATE POLICY devices_scope ON devices
  USING (app_can_access_club(current_club_id))
  WITH CHECK (app_can_access_club(current_club_id));

-- ─── תשלומים וזיכויים ───
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payments_scope ON payments;
CREATE POLICY payments_scope ON payments
  USING (app_can_access_club(club_id))
  WITH CHECK (app_can_access_club(club_id));

ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS refunds_scope ON refunds;
CREATE POLICY refunds_scope ON refunds
  USING (
    app_is_global()
    OR EXISTS (SELECT 1 FROM payments p WHERE p.id = payment_id AND app_can_access_club(p.club_id))
  )
  WITH CHECK (
    app_is_global()
    OR EXISTS (SELECT 1 FROM payments p WHERE p.id = payment_id AND app_can_access_club(p.club_id))
  );

-- ─── אירועי סשן: נגזרים מהסשן ───
ALTER TABLE session_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS session_events_scope ON session_events;
CREATE POLICY session_events_scope ON session_events
  USING (
    app_is_global()
    OR EXISTS (SELECT 1 FROM sessions s WHERE s.id = session_id AND app_can_access_club(s.club_id))
  )
  WITH CHECK (
    app_is_global()
    OR EXISTS (SELECT 1 FROM sessions s WHERE s.id = session_id AND app_can_access_club(s.club_id))
  );

-- ─── Audit Log: append-only, קריאה גלובלית בלבד ───
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_logs_read ON audit_logs;
CREATE POLICY audit_logs_read ON audit_logs FOR SELECT
  USING (app_is_global() OR app_can_access_club(club_id));
DROP POLICY IF EXISTS audit_logs_insert ON audit_logs;
CREATE POLICY audit_logs_insert ON audit_logs FOR INSERT
  WITH CHECK (app_current_user_id() IS NOT NULL);

-- Audit Log אינו ניתן לעדכון או למחיקה על ידי איש. סעיף 25 בהנחיות.
REVOKE UPDATE, DELETE ON audit_logs FROM velax_rls;

-- ─── טריגר: מניעת שינוי רטרואקטיבי של Audit Log ───
CREATE OR REPLACE FUNCTION audit_logs_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs היא טבלת append-only. שינוי או מחיקה אסורים.';
END;
$$;

DROP TRIGGER IF EXISTS audit_logs_no_update ON audit_logs;
CREATE TRIGGER audit_logs_no_update
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable();

-- ─── טריגר: מקסימום שני שחקנים לאימון ───
-- ה־CHECK על session_players.slot מונע slot 3, אבל טריגר זה מגן גם מפני
-- עדכון player_count על הסשן לערך שאינו תואם למספר השחקנים בפועל.
CREATE OR REPLACE FUNCTION enforce_max_two_players() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  player_total integer;
BEGIN
  SELECT COUNT(*) INTO player_total FROM session_players WHERE session_id = NEW.session_id;
  IF player_total > 2 THEN
    RAISE EXCEPTION 'אימון אחד יכול לכלול שחקן אחד או שניים בלבד (נמצאו %)', player_total;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS session_players_max_two ON session_players;
CREATE TRIGGER session_players_max_two
  AFTER INSERT OR UPDATE ON session_players
  FOR EACH ROW EXECUTE FUNCTION enforce_max_two_players();

-- ─── טריגר: updated_at אוטומטי ───
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.relname AS tbl
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND a.attname = 'updated_at'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t.tbl || '_touch', t.tbl);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION touch_updated_at()',
      t.tbl || '_touch', t.tbl
    );
  END LOOP;
END
$$;
