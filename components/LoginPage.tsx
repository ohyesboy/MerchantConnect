import React, { useState } from 'react';
import { loginWithGoogle, loginWithMicrosoft } from '../services/firebaseService';

interface LoginPageProps {
  logoHtml?: string;
}

export const LoginPage: React.FC<LoginPageProps> = ({ logoHtml }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await loginWithGoogle();
    } catch (err) {
      console.error("Google login failed", err);
      setError('Google login failed. Please try again.');
      setIsLoading(false);
    }
  };

  const handleMicrosoftLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await loginWithMicrosoft();
    } catch (err) {
      console.error("Microsoft login failed", err);
      setError('Microsoft login failed. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          {logoHtml ? (
            <div dangerouslySetInnerHTML={{ __html: logoHtml }} className="flex justify-center mb-4"></div>
          ) : (
            <h1 className="text-3xl font-bold text-blue-600 tracking-tight">
              Merchant<span className="text-slate-800">Connect</span>
            </h1>
          )}
          <p className="text-slate-600 mt-2">Connect with suppliers and manage your wholesale catalog</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Login Buttons */}
        <div className="space-y-4">
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white border-2 border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="fab fa-google text-lg"></i>
            {isLoading ? 'Signing in...' : 'Sign in with Google'}
          </button>

          <button
            onClick={handleMicrosoftLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white border-2 border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="fab fa-microsoft text-lg"></i>
            {isLoading ? 'Signing in...' : 'Sign in with Microsoft'}
          </button>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-slate-200 text-center">
          <p className="text-sm text-slate-600">
            By signing in, you agree to our terms of service
          </p>
        </div>
      </div>
    </div>
  );
};

