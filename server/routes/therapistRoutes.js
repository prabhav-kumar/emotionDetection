import express from 'express';
import jwt from 'jsonwebtoken';
import Therapist from '../models/Therapist.js';
import Patient from '../models/Patient.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Therapist Signup
router.post('/signup', async (req, res) => {
    try {
        const { name, email, phone, experience, password } = req.body;

        // Check if therapist already exists
        let therapist = await Therapist.findOne({ email });
        if (therapist) {
            return res.status(400).json({ message: 'Therapist already exists' });
        }

        // Create new therapist
        therapist = new Therapist({
            name,
            email,
            phone,
            experience,
            password
        });

        await therapist.save();

        // Generate JWT token
        const token = jwt.sign(
            { id: therapist._id, role: 'therapist' },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            token,
            therapist: {
                id: therapist._id,
                name: therapist.name,
                email: therapist.email,
                phone: therapist.phone,
                experience: therapist.experience
            }
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ message: messages.join(', ') });
        }
        res.status(500).json({ message: 'Server error' });
    }
});

// Therapist Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find therapist by email
        const therapist = await Therapist.findOne({ email });
        if (!therapist) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Verify password
        const isMatch = await therapist.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: therapist._id, role: 'therapist' },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            therapist: {
                id: therapist._id,
                name: therapist.name,
                email: therapist.email,
                phone: therapist.phone,
                experience: therapist.experience
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get all therapists
router.get('/all', auth, async (req, res) => {
    try {
        const therapists = await Therapist.find().select('-password');
        res.json(therapists);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Select a therapist
router.post('/:therapistId/select', auth, async (req, res) => {
    try {
        const therapist = await Therapist.findById(req.params.therapistId);
        if (!therapist) {
            return res.status(404).json({ message: 'Therapist not found' });
        }
        res.json({ message: 'Therapist selected successfully', therapist });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get therapist profile (Protected route)
router.get('/profile', auth, async (req, res) => {
    try {
        const therapist = await Therapist.findById(req.user.id).select('-password');
        res.json(therapist);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});




// Get all patients assigned to the therapist
router.get('/assigned-patients', auth, async (req, res) => {
    try {
        const patients = await Patient.find({ selectedTherapist: req.user.id }).select('-password');
        res.json(patients);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;