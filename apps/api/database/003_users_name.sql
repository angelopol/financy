-- Some Laravel installations of this app never had a `name` column on users.
-- Every part of the API (auth, profile, AI context) assumes it exists.
ALTER TABLE users ADD COLUMN IF NOT EXISTS name varchar(255) NOT NULL DEFAULT '';
