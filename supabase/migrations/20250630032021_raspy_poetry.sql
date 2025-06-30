-- Step 1: Check current admin accounts (optional - for verification)
SELECT user_id, name, email, role, created_at 
FROM users 
WHERE role = 'admin';

-- Step 2: Delete all existing admin accounts
DELETE FROM users WHERE role = 'admin';

-- Step 3: Create new admin account
-- Note: You'll need to hash the password using bcrypt with salt rounds 10
-- The hashed version of 'admin123' is provided below
INSERT INTO users (name, email, password, role, phone_number, town, is_active, created_at, updated_at)
VALUES (
    'SmartBite Administrator',
    'admin@smartbite.cm',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- This is 'password' hashed
    'admin',
    '+237680938302',
    'Douala',
    true,
    NOW(),
    NOW()
);

-- Step 4: Verify the new admin account was created
SELECT user_id, name, email, role, phone_number, town, is_active, created_at 
FROM users 
WHERE role = 'admin';