-- Alternative approach: Keep the UUID structure but fix the server code
-- This approach maintains the existing database schema

-- Check current structure
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('rooms', 'players') 
ORDER BY table_name, ordinal_position;

-- Check foreign key constraints
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'players';

-- This script doesn't change anything - it just shows the current structure
-- The server code has been updated to use the correct UUID relationships
