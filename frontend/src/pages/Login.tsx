import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService, profileService } from '../services/apiService';
import toast from 'react-hot-toast';

const Login: React.FC = () => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const { login, setOnboardingComplete } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await authService.login(email, password);
      const { user, token } = response.data;

      login(user, token);

      try {
        const profileRes = await profileService.getProfile(user._id);
        // ✅ correct path: data.data.profile.aboutMe (not data.data.aboutMe)
        const profile = profileRes.data?.data?.profile || {};
        const aboutMe = profile?.aboutMe?.trim() || '';

        if (aboutMe.length > 0) {
          // ✅ localStorage set SYNCHRONOUSLY before navigate — no race condition
          localStorage.setItem('onboardingComplete', 'true');
          setOnboardingComplete(true);
          toast.success('Welcome back!');
          navigate('/dashboard');
        } else {
          localStorage.setItem('onboardingComplete', 'false');
          setOnboardingComplete(false);
          navigate('/onboarding');
        }
      } catch {
        // No profile doc yet — brand new user
        localStorage.setItem('onboardingComplete', 'false');
        setOnboardingComplete(false);
        navigate('/onboarding');
      }

    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary-600 mb-2">Presenz</h1>
          <p className="text-gray-600">Your Presence, Always On</p>
        </div>

        <div className="card p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Welcome Back</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full"
            >
              {loading
                ? <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Signing in...
                  </span>
                : 'Sign In'
              }
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;