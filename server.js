const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => console.log('❌ MongoDB connection error:', err.message));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/doctors', require('./routes/doctorRoutes'));
app.use('/api/appointments', require('./routes/appointmentRoutes'));

// Health Check Endpoint
app.get('/api/health', (req, res) => {
    const fs = require('fs');
    const path = require('path');
    
    const doctorsPath = path.join(__dirname, './data/doctors.json');
    const doctorsExist = fs.existsSync(doctorsPath);
    
    let doctorCount = 0;
    if (doctorsExist) {
        try {
            const data = fs.readFileSync(doctorsPath, 'utf8');
            const doctors = JSON.parse(data);
            doctorCount = doctors.length;
        } catch (error) {
            console.error('Error reading doctors.json:', error.message);
        }
    }
    
    res.json({
        status: 'OK',
        message: 'API is working',
        timestamp: new Date().toISOString(),
        mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
        doctorsFile: {
            exists: doctorsExist,
            path: doctorsPath,
            doctorCount: doctorCount
        }
    });
});

// Test route
app.get('/api/test', (req, res) => {
    res.json({ message: 'API is working!' });
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('❌ Server error:', err.stack);
    res.status(500).json({ message: 'Server error', error: err.message });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📍 API URL: http://localhost:${PORT}/api`);
    console.log(`🏥 Health Check: http://localhost:${PORT}/api/health\n`);
});
