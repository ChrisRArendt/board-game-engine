-- If migrations applied but API still says "Could not find column ... in the schema cache",
-- run this in the Supabase SQL Editor to refresh PostgREST's cache:
NOTIFY pgrst, 'reload schema';
