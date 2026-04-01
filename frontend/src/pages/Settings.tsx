import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { statusService, sessionService } from '../services/apiService';
import { StudentStatus } from '../types';
import { Settings as SettingsIcon, Smartphone, Clock, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';

const Settings: React.FC = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState<StudentStatus | null>(null);
  const [sessionStatus, setSessionStatus] = useState<string>('disconnected');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [statusRes, sessionRes] = await Promise.all([
        statusService.get(user!._id),
        sessionService.getStatus(user!._id),
      ]);

      setStatus(statusRes.data);
      setSessionStatus(sessionRes.data.status);
    } catch (error: any) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!status) return;

    setSaving(true);
    try {
      await statusService.updateSettings(
        user!._id,
        status.autoAwayEnabled,
        status.autoAwayMinutes
      );
      toast.success('Settings saved successfully!');
    } catch (error: any) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnectWhatsApp = async () => {
    if (!window.confirm('Are you sure you want to disconnect WhatsApp?')) {
      return;
    }

    try {
      await sessionService.disconnect(user!._id);
      setSessionStatus('disconnected');
      toast.success('WhatsApp disconnected');
    } catch (error: any) {
      toast.error('Failed to disconnect WhatsApp');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Settings</h1>

      {/* WhatsApp Connection */}
      <div className="card p-6">
        <div className="flex items-center mb-4">
          <Smartphone className="w-6 h-6 text-primary-600 mr-3" />
          <h3 className="text-lg font-semibold text-gray-900">WhatsApp Connection</h3>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Status</p>
            <p className={`font-medium ${
              sessionStatus === 'connected' ? 'text-green-600' : 'text-gray-900'
            }`}>
              {sessionStatus === 'connected' ? 'Connected' : 'Disconnected'}
            </p>
          </div>
          {sessionStatus === 'connected' && (
            <button
              onClick={handleDisconnectWhatsApp}
              className="btn btn-danger flex items-center"
            >
              <LogOut className="w-5 h-5 mr-2" />
              Disconnect
            </button>
          )}
        </div>
      </div>

      {/* Auto-Away Settings */}
      <div className="card p-6">
        <div className="flex items-center mb-4">
          <Clock className="w-6 h-6 text-primary-600 mr-3" />
          <h3 className="text-lg font-semibold text-gray-900">Auto-Away Settings</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Enable Auto-Away</p>
              <p className="text-sm text-gray-600">
                Automatically switch to away mode after inactivity
              </p>
            </div>
            <button
              onClick={() => setStatus({ ...status!, autoAwayEnabled: !status!.autoAwayEnabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                status?.autoAwayEnabled ? 'bg-primary-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  status?.autoAwayEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {status?.autoAwayEnabled && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Inactivity timeout (minutes)
              </label>
              <input
                type="number"
                min="5"
                max="120"
                value={status.autoAwayMinutes}
                onChange={(e) => setStatus({ ...status, autoAwayMinutes: Number(e.target.value) })}
                className="input max-w-xs"
              />
              <p className="text-sm text-gray-500 mt-1">
                Switch to away after {status.autoAwayMinutes} minutes of inactivity
              </p>
            </div>
          )}
        </div>

        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="btn btn-primary mt-6"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Account Info */}
      <div className="card p-6">
        <div className="flex items-center mb-4">
          <SettingsIcon className="w-6 h-6 text-primary-600 mr-3" />
          <h3 className="text-lg font-semibold text-gray-900">Account Information</h3>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-sm text-gray-600">Name</p>
            <p className="font-medium text-gray-900">{user?.name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Email</p>
            <p className="font-medium text-gray-900">{user?.email}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Phone</p>
            <p className="font-medium text-gray-900">{user?.phone}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Subscription</p>
            <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${
              user?.subscriptionStatus === 'active'
                ? 'bg-green-100 text-green-700'
                : user?.subscriptionStatus === 'trial'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {user?.subscriptionStatus}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;