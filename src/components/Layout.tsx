import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useVerification } from '../contexts/VerificationContext';
import { Video, User, LogOut, Fingerprint, Check, X } from 'lucide-react';

const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const { verification } = useVerification();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex">
              <Link to="/dashboard" className="flex items-center">
                <Video className="h-8 w-8 text-blue-600" />
                <span className="ml-2 text-xl font-bold text-gray-900">SecureCall</span>
              </Link>
            </div>
            <div className="flex items-center">
              <div className="flex space-x-4 mr-4">
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-1 ${verification.faceVerified ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-sm text-gray-600">Face</span>
                </div>
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-1 ${verification.fingerprintVerified ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-sm text-gray-600">Fingerprint</span>
                </div>
              </div>
              <div className="relative group">
                <button className="flex items-center text-gray-700 hover:text-gray-900">
                  <div className="h-8 w-8 rounded-full bg-blue-200 flex items-center justify-center">
                    <User className="h-5 w-5 text-blue-700" />
                  </div>
                  <span className="ml-2">{user?.username}</span>
                </button>
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10 hidden group-hover:block">
                  <button 
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <LogOut className="h-4 w-4 inline mr-2" />
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main>
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;