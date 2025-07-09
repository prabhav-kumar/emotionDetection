import express from 'express';
import jwt from 'jsonwebtoken';
import Patient from '../models/Patient.js';
import Therapist from '../models/Therapist.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Get all therapists
router.get('/therapists', auth, async (req, res) => {
    try {
        const therapists = await Therapist.find().select('-password');
        res.json(therapists);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Select a therapist
router.post('/select/:therapistId', auth, async (req, res) => {
    try {
        const patient = await Patient.findById(req.user.id);
        if (!patient) {
            return res.status(404).json({ message: 'Patient not found' });
        }

        const therapist = await Therapist.findById(req.params.therapistId);
        if (!therapist) {
            return res.status(404).json({ message: 'Therapist not found' });
        }

        patient.selectedTherapist = therapist._id;
        await patient.save();

        res.json({ message: 'Therapist selected successfully', therapist });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get selected therapist
router.get('/selected-therapist', auth, async (req, res) => {
    try {
        const patient = await Patient.findById(req.user.id).populate('selectedTherapist', '-password');
        if (!patient) {
            return res.status(404).json({ message: 'Patient not found' });
        }

        if (!patient.selectedTherapist) {
            return res.status(404).json({ message: 'No therapist selected' });
        }

        res.json(patient.selectedTherapist);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Patient Signup
router.post('/signup', async (req, res) => {
    try {
        const { name, email, phone, gender, age, occupation, password } = req.body;

        // Check if patient already exists
        let patient = await Patient.findOne({ email });
        if (patient) {
            return res.status(400).json({ message: 'Patient already exists' });
        }

        // Create new patient
        patient = new Patient({
            name,
            email,
            phone,
            gender,
            age,
            occupation,
            password
        });

        await patient.save();

        // Generate JWT token
        const token = jwt.sign(
            { id: patient._id, role: 'patient' },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            token,
            patient: {
                id: patient._id,
                name: patient.name,
                email: patient.email,
                phone: patient.phone,
                gender: patient.gender,
                age: patient.age,
                occupation: patient.occupation
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

// Patient Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find patient by email
        const patient = await Patient.findOne({ email });
        if (!patient) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Verify password
        const isMatch = await patient.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: patient._id, role: 'patient' },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            patient: {
                id: patient._id,
                name: patient.name,
                email: patient.email,
                phone: patient.phone,
                gender: patient.gender,
                age: patient.age,
                occupation: patient.occupation
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get patient profile (Protected route)
router.get('/profile', auth, async (req, res) => {
    try {
        const patient = await Patient.findById(req.user.id).select('-password');
        if (!patient) {
            return res.status(404).json({ message: 'Patient not found' });
        }
        res.json(patient);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get all available therapists
router.get('/therapists', auth, async (req, res) => {
    try {
        const therapists = await Therapist.find()
            .select('-password -__v')
            .sort({ experience: -1 });

        res.json(therapists);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Select a therapist
router.post('/select-therapist/:therapistId', auth, async (req, res) => {
    try {
        const patient = await Patient.findById(req.user.id);
        const therapist = await Therapist.findById(req.params.therapistId);

        if (!therapist) {
            return res.status(404).json({ message: 'Therapist not found' });
        }

        patient.selectedTherapist = therapist._id;
        await patient.save();

        res.json({ message: 'Therapist selected successfully', therapistId: therapist._id });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;  // ES6 default export