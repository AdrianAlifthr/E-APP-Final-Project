CREATE TABLE IF NOT EXISTS public.activity_logs (
    log_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    admin_id text NOT NULL,
    admin_name text NOT NULL,
    action text NOT NULL,
    object_label text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_logs_created_at_idx
    ON public.activity_logs (created_at DESC);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.activity_logs_log_id_seq TO authenticated;

DROP POLICY IF EXISTS "Admins can read activity logs" ON public.activity_logs;
CREATE POLICY "Admins can read activity logs"
    ON public.activity_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.users AS u
            WHERE u.user_id::text = auth.uid()::text
              AND u.role = 'admin'
              AND COALESCE(u.is_active, true)
        )
    );

DROP POLICY IF EXISTS "Admins can add activity logs" ON public.activity_logs;
CREATE POLICY "Admins can add activity logs"
    ON public.activity_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        admin_id = auth.uid()::text
        AND EXISTS (
            SELECT 1
            FROM public.users AS u
            WHERE u.user_id::text = auth.uid()::text
              AND u.role = 'admin'
              AND COALESCE(u.is_active, true)
        )
    );

NOTIFY pgrst, 'reload schema';
