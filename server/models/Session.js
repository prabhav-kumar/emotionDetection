import mongoose from 'mongoose';

const transcriptEntrySchema = new mongoose.Schema({
    id: { type: String, required: true }, // Unique ID for the transcript segment
    speaker: { type: String, enum: ['Patient', 'Therapist', 'System'], required: true },
    text: { type: String, required: true },
    timestamp: { type: String, required: true }, // Could be a more specific Date type if needed for precise sorting
    // emotion: { type: String } // Emotion associated with this specific transcript by the patient
});

const emotionEntrySchema = new mongoose.Schema({
    id: { type: String, required: true }, // Unique ID for the emotion entry
    emotion: { type: String, required: true },
    timestamp: { type: String, required: true }, // Should correlate with transcript timestamps
    color: { type: String, required: true } // Color for UI display
});

const analysisSchema = new mongoose.Schema({
    transcripts: [transcriptEntrySchema],
    emotion: emotionEntrySchema
});

const sessionSchema = new mongoose.Schema({
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient',
        required: true
    },
    therapist: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Therapist',
        required: true
    },
    sessionDate: {
        type: Date,
        default: Date.now,
        required: true
    },
    roomName: { // The WebRTC room name or an identifier for the call
        type: String,
        required: true
    },
    analyses: [analysisSchema], // Array of analyses, each with transcripts and emotion
    // Optional: Store overall analysis if generated
    overallAnalysis: {
        sentimentTrend: String,
        keyTopics: [String],
        // Add other summary fields as needed
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Session = mongoose.model('Session', sessionSchema);

export default Session;