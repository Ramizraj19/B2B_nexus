import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usersAPI } from '../../api';

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const query = new URLSearchParams(location.search);
  const token = query.get('token') || '';

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    const res = await usersAPI.resetPassword(token, password);
    setLoading(false);
    if (res.success) {
      setMessage('Password reset successfully. You can now log in.');
      setTimeout(() => navigate('/login'), 1500);
    } else {
      setError(res.message || 'Failed to reset password');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white p-6 rounded-lg shadow">
        <h1 className="text-2xl font-bold mb-4">Reset Password</h1>
        <p className="text-sm text-gray-600 mb-4">Enter your new password.</p>
        {message && <div className="text-green-600 text-sm mb-3">{message}</div>}
        {error && <div className="text-red-600 text-sm mb-3">{error}</div>}
        <form onSubmit={onSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
            className="w-full border border-gray-300 rounded px-3 py-2 mb-3"
            minLength={6}
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded py-2"
          >
            {loading ? 'Resetting...' : 'Reset password'}
          </button>
        </form>
        <button
          onClick={() => navigate('/login')}
          className="w-full mt-3 text-blue-600"
        >
          Back to login
        </button>
      </div>
    </div>
  );
};

export default ResetPasswordPage;


