# Backend Server Setup for Trae Saptaras

This is the backend server implementation for Trae Saptaras, handling user authentication for both therapists and patients.

## Setup Instructions

1. Install dependencies:
```bash
npm install express mongoose bcryptjs jsonwebtoken cors dotenv
```

2. Configure Environment Variables:
- Create a `.env` file in the server directory
- Add the following variables:
  ```
  MONGODB_URI=your_mongodb_atlas_connection_string_here
  JWT_SECRET=your_secure_jwt_secret_here
  PORT=5000
  ```

3. MongoDB Atlas Setup:
- Create a MongoDB Atlas account
- Create a new cluster
- Get your connection string
- Replace `your_mongodb_atlas_connection_string_here` in `.env` with your actual connection string

4. Start the server:
```bash
node server.js
```

## API Endpoints

### Therapist Routes
- POST `/api/therapists/signup` - Register a new therapist
- POST `/api/therapists/login` - Login for therapists
- GET `/api/therapists/profile` - Get therapist profile (Protected)

### Patient Routes
- POST `/api/patients/signup` - Register a new patient
- POST `/api/patients/login` - Login for patients
- GET `/api/patients/profile` - Get patient profile (Protected)

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Protected routes require a valid JWT token in the Authorization header:
```
Authorization: Bearer <your_token_here>
```

## Models

### Therapist
- name (String, required)
- email (String, required, unique)
- phone (String, required)
- experience (Number, required)
- password (String, required)

### Patient
- name (String, required)
- email (String, required, unique)
- phone (String, required)
- gender (String, required)
- age (Number, required)
- occupation (String, required)
- password (String, required)