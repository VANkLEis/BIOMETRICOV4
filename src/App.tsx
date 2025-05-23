import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { VerificationProvider } from './contexts/VerificationContext';
import { RoleProvider } from './contexts/RoleContext';
import { LogoProvider } from './contexts/LogoContext';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import FacialVerification from './pages/FacialVerification';
import FingerprintVerification from './pages/FingerprintVerification';
import VideoCall from './pages/VideoCall';
import Settings from './pages/Settings';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

function App() {
  return (
    <Router>
      <AuthProvider>
        <VerificationProvider>
          <RoleProvider>
            <LogoProvider>
              <Routes>
                <Route path="/" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/settings" element={<Settings />} />
                <Route element={<Layout />}>
                  <Route 
                    path="/dashboard" 
                    element={
                      <ProtectedRoute>
                        <Dashboard />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/verify/face" 
                    element={
                      <ProtectedRoute>
                        <FacialVerification />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/verify/fingerprint" 
                    element={
                      <ProtectedRoute>
                        <FingerprintVerification />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/video-call/:roomId" 
                    element={
                      <ProtectedRoute requireVerification={true}>
                        <VideoCall />
                      </ProtectedRoute>
                    } 
                  />
                </Route>
              </Routes>
            </LogoProvider>
          </RoleProvider>
        </VerificationProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;