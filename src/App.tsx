import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LogoProvider } from './contexts/LogoContext';
import { RoleProvider } from './contexts/RoleContext';
import { VerificationProvider } from './contexts/VerificationContext';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import VideoCall from './pages/VideoCall';
import Settings from './pages/Settings';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

function App() {
  return (
    <AuthProvider>
      <LogoProvider>
        <RoleProvider>
          <VerificationProvider>
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
                  path="/video-call/:roomId?" 
                  element={
                    <ProtectedRoute>
                      <VideoCall />
                    </ProtectedRoute>
                  } 
                />
              </Route>
            </Routes>
          </VerificationProvider>
        </RoleProvider>
      </LogoProvider>
    </AuthProvider>
  );
}

export default App;