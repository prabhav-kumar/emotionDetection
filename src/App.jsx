import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import LandingPage from './LandingPage'
import TherapistPage from './therapist/TherapistPage'
import TherapistAboutPage from './therapist/TherapistAboutPage'
import TherapistFAQsPage from './therapist/TherapistFAQsPage'
import TherapistContactPage from './therapist/TherapistContactPage'
import PatientPage from './patient/PatientPage'
import PatientAboutPage from './patient/PatientAboutPage'
import PatientFAQs from './patient/PatientFAQs'
import PatientContactPage from './patient/PatientContactPage'
import PatientAuthPage from './patient/PatientAuthPage'
import TherapistAuthPage from './therapist/TherapistAuthPage'
import TherapistMainPage from './therapist_main/TherapistMainPage'
import TherapistMainUploadPage from './therapist_main/TherapistMainUploadPage'
import TherapistMainHistoryPage from './therapist_main/TherapistMainHistoryPage'
import PatientMainPage from './patient_main/PatientMainPage'
import ProtectedRoute from './components/ProtectedRoute'
import PatientMainSelectTherapistPage from './patient_main/PatientMainSelectTherapistPage'

function App() {
  return (
      <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/therapist/TherapistPage" element={<TherapistPage />} />
        <Route path="/therapist/TherapistAboutPage" element={<TherapistAboutPage />} />
        <Route path="/therapist/TherapistFAQsPage" element={<TherapistFAQsPage />} />
        <Route path="/therapist/TherapistContactPage" element={<TherapistContactPage />} />
        <Route path="/therapist/TherapistAuthPage" element={<TherapistAuthPage />} />
        <Route path="/patient/PatientPage" element={<PatientPage />} />
        <Route path="/patient/PatientAboutPage" element={<PatientAboutPage />} />
        <Route path="/patient/PatientFAQsPage" element={<PatientFAQs />} />
        <Route path="/patient/PatientContactPage" element={<PatientContactPage />} />
        <Route path="/patient/PatientAuthPage" element={<PatientAuthPage />} />
        <Route path="/therapist_main/TherapistMainPage" element={<ProtectedRoute element={TherapistMainPage} userRole="therapist" />} />
        <Route path="/therapist_main/TherapistMainUploadPage" element={<ProtectedRoute element={TherapistMainUploadPage} userRole="therapist" />} />  
        <Route path="/therapist_main/TherapistMainHistoryPage" element={<ProtectedRoute element={TherapistMainHistoryPage} userRole="therapist" />} />   
        <Route path="/patient_main/PatientMainPage" element={<ProtectedRoute element={PatientMainPage} userRole="patient" />} />      
        <Route path="/patient_main/PatientMainSelectTherapistPage" element={<ProtectedRoute element={PatientMainSelectTherapistPage} userRole="patient" />} />      
      </Routes>
      </Router>
  )
}

export default App
