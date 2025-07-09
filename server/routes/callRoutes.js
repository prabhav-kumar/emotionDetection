import express from 'express';
import Session from '../models/Session.js'; // Import the Session model
import authMiddleware from '../middleware/auth.js'; // Assuming you have auth middleware

const router = express.Router();

// POST /api/calls/start
router.post('/start', (req, res) => {
    // Basic implementation for starting a call
    // You can extend this with database logic or signaling as needed
    console.log('Call start request received:', req.body);

    // Respond with success and any relevant data
    res.status(200).json({ message: 'Call started successfully' });
});

// Temporary debug route - REMOVE LATER
router.post('/save-session-debug', async (req, res) => {
    console.log('[DEBUG /save-session-debug] Raw request body:', JSON.stringify(req.body, null, 2));
    res.status(200).json({ message: 'Debug data logged. Check server console.' });
});

// POST /api/calls/save-session
// Saves the transcript and emotion data for a completed session
router.post('/save-session', authMiddleware, async (req, res) => {
    console.log('[LOG /save-session] Authenticated route hit. Request body:', JSON.stringify(req.body, null, 2));
    console.log('[DEBUG] Incoming save-session body:', JSON.stringify(req.body, null, 2));
    console.log('[LOG /save-session] req.user from authMiddleware:', JSON.stringify(req.user, null, 2));
    try {
        const { patientId, therapistId, roomName, analyses, overallAnalysis } = req.body;

        if (!patientId || !therapistId || !roomName || !analyses || !Array.isArray(analyses) || analyses.length === 0) {
            return res.status(400).json({ message: 'Missing required session data.' });
        }

        const newSession = new Session({
            patient: patientId,
            therapist: therapistId,
            roomName,
            analyses,
            overallAnalysis: overallAnalysis || {},
            sessionDate: new Date() // Or pass a specific date from client if available
        });

        await newSession.save();
        res.status(201).json({ message: 'Session data saved successfully.', sessionId: newSession._id });
    } catch (error) {
        console.error('Error saving session data:', error);
        res.status(500).json({ message: 'Failed to save session data.', error: error.message });
    }
});

// GET /api/calls/sessions/patient/:patientId
// Retrieves all session summaries for a specific patient (e.g., for the dropdown)
router.get('/sessions/patient/:patientId', authMiddleware, async (req, res) => {
    try {
        const { patientId } = req.params;
        // Ensure the logged-in therapist is authorized to view this patient's sessions
        // This might involve checking if the patient is assigned to the therapist
        // For simplicity, this check is omitted here but crucial in a real app.

        const sessions = await Session.find({ patient: patientId })
            .select('_id sessionDate roomName') // Select only necessary fields for the list
            .sort({ sessionDate: -1 }); // Sort by most recent first

        if (!sessions) {
            return res.status(404).json({ message: 'No sessions found for this patient.' });
        }
        res.status(200).json(sessions);
    } catch (error) {
        console.error('Error fetching patient sessions:', error);
        res.status(500).json({ message: 'Failed to fetch patient sessions.', error: error.message });
    }
});

// GET /api/calls/session/:sessionId
// Retrieves detailed information for a specific session
router.get('/session/:sessionId', authMiddleware, async (req, res) => {
  try {
    const session = await Session.findById(req.params.sessionId)
      .populate('patient', 'name') // Populate patient's name
      .populate('therapist', 'name'); // Populate therapist's name

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Ensure the therapist requesting is part of this session
    // req.user.id should be the therapist's _id
    if (session.therapist._id.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Unauthorized to view this session' });
    }

    // Transform the session object to include patientName and therapistName directly
    const sessionData = session.toObject();
    sessionData.patientName = session.patient.name;
    sessionData.therapistName = session.therapist.name;
    // Optionally remove the populated objects if only names are needed
    // delete sessionData.patientId; // Corrected to patient
    // delete sessionData.therapistId; // Corrected to therapist

    res.json(sessionData);
  } catch (error) {
    console.error('Error fetching session details:', error);
    res.status(500).json({ message: 'Server error while fetching session details' });
  }
});

export default router;
