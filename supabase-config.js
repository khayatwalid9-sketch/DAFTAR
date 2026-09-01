// Supabase Configuration
// This file contains sensitive credentials and should not be committed to git
const SUPABASE_CONFIG = {
  url: 'https://jmwkkpiddnlfucgejmpd.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imptd2trcGlkZG5sZnVjZ2VqbXBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxNjUwNjksImV4cCI6MjEwMzc0MTA2OX0.wgPv9jx05jAj4p1eNx6-_p23EqIDc04PNRWHQ83CK0A'
};

// For Vercel deployment, use environment variables instead
if (typeof process !== 'undefined' && process.env) {
  SUPABASE_CONFIG.url = process.env.VITE_SUPABASE_URL || SUPABASE_CONFIG.url;
  SUPABASE_CONFIG.anonKey = process.env.VITE_SUPABASE_ANON_KEY || SUPABASE_CONFIG.anonKey;
}
