const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase URL or Key is missing in environment variables.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

app.use(cors());
app.use(express.json());

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Backend is running',
    supabaseConnected: !!supabase
  });
});

// Middleware to expose Supabase to routes (optional but helpful)
app.use((req, res, next) => {
  req.supabase = supabase;
  next();
});

// Example route using Supabase
app.get('/api/test-db', async (req, res) => {
  try {
    // Just a simple query to verify connection
    const { data, error } = await supabase.from('_metadata').select('*').limit(1);
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
