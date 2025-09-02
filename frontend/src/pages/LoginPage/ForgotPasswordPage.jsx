import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usersAPI } from '../../api';

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    const res = await usersAPI.forgotPassword(email);
    setLoading(false);
    if (res.success) {
      setMessage(res.message || 'If an account exists, a reset link was sent.');
    } else {
      setError(res.message || 'Failed to send reset email');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white p-6 rounded-lg shadow">
        <h1 className="text-2xl font-bold mb-4">Forgot Password</h1>
        <p className="text-sm text-gray-600 mb-4">Enter your email to receive a reset link.</p>
        {message && <div className="text-green-600 text-sm mb-3">{message}</div>}
        {error && <div className="text-red-600 text-sm mb-3">{error}</div>}
        <form onSubmit={onSubmit}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full border border-gray-300 rounded px-3 py-2 mb-3"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded py-2"
          >
            {loading ? 'Sending...' : 'Send reset link'}
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

export default ForgotPasswordPage;


