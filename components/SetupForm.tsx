import React, { useState } from 'react';

interface SetupFormProps {
  onComplete: (config: string, adminEmail: string) => void;
}

export const SetupForm: React.FC<SetupFormProps> = ({ onComplete }) => {
  const [configStr, setConfigStr] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      JSON.parse(configStr); // Validate JSON
      if (!email.includes('@')) throw new Error("Invalid email");
      onComplete(configStr, email);
    } catch (err) {
      setError("Invalid JSON configuration or email format.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-lg w-full">
        <h1 className="text-2xl font-bold mb-6 text-slate-800">App Configuration</h1>
        <p className="mb-4 text-slate-600 text-sm">Please provide the required configuration to start the Merchant App.</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Admin Email (Receiver)</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="admin@example.com"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Firebase Config (JSON)</label>
            <textarea
              required
              rows={8}
              value={configStr}
              onChange={(e) => setConfigStr(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder='{ "apiKey": "...", "authDomain": "...", ... }'
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition font-semibold"
          >
            Launch App
          </button>
        </form>
      </div>
    </div>
  );
};