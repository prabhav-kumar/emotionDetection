import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import http from 'http';
import { initializeSignalingServer } from './signaling.js';

// Import routes using ES modules syntax
import therapistRoutes from './routes/therapistRoutes.js';
import patientRoutes from './routes/patientRoutes.js';
import callRoutes from './routes/callRoutes.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, etc)
        if(!origin) return callback(null, true);
        
        // Allow localhost and any ngrok URLs
        if(origin.startsWith('http://localhost') || 
           origin.startsWith('https://localhost') || 
           origin.includes('ngrok-free.app') ||
           origin === 'https://manoswara.loca.lt') {
            return callback(null, true);
        }
        
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }));

  console.log('Express server initialized with dynamic CORS support');
  
app.use(express.json());

// MongoDB Atlas Connection
mongoose.connect(process.env.MONGODB_URI).then(() => {
    console.log('Connected to MongoDB Atlas');
}).catch((error) => {
    console.error('MongoDB connection error:', error);
});

// Use routes
app.use('/api/therapists', therapistRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/calls', callRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;

// Initialize WebSocket signaling server
const io = initializeSignalingServer(server);

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
