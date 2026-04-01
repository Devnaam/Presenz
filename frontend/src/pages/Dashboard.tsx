import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { dashboardService, statusService } from '../services/apiService';
import { DashboardSummary, StudentStatus } from '../types';
import { MessageCircle, Users, Zap, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [studentStatus, setStudentStatus] = useState<StudentStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const [summaryRes, statusRes] = await Promise.all([
        dashboardService.getSummary(user!._id),
        statusService.get(user!._id),
      ]);

      setSummary(summaryRes.data);
      setStudentStatus(statusRes.data);
    } catch (error: any) {
      toast.error('Failed to load dashboard');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = async () => {
    if (!studentStatus) return;

    const newMode = studentStatus.mode === 'available' ? 'away' : 'available';

    try {
      const response = await statusService.setMode(user!._id, newMode);
      setStudentStatus(response.data);
      toast.success(`Status changed to ${newMode}`);
    } catch (error: any) {
      toast.error('Failed to change status');
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
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome back, {user?.name}</p>
      </div>

      {/* Status Toggle */}
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Your Status</h3>
            <p className="text-sm text-gray-600 mt-1">
              {studentStatus?.mode === 'available'
                ? 'You are available - AI will not reply'
                : 'You are away - AI will handle messages'}
            </p>
          </div>
          <button
            onClick={toggleMode}
            className={`relative inline-flex h-12 w-24 items-center rounded-full transition-colors ${
              studentStatus?.mode === 'away' ? 'bg-primary-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-10 w-10 transform rounded-full bg-white shadow-lg transition-transform ${
                studentStatus?.mode === 'away' ? 'translate-x-12' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {studentStatus?.autoAwayEnabled && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800 flex items-center">
              <Clock className="w-4 h-4 mr-2" />
              Auto-away enabled: Switches to away after {studentStatus.autoAwayMinutes} minutes of inactivity
            </p>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Messages Received</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {summary?.today.messagesReceived || 0}
              </p>
            </div>
            <div className="p-3 bg-primary-100 rounded-lg">
              <MessageCircle className="w-6 h-6 text-primary-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Today</p>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">AI Replies Sent</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {summary?.today.aiRepliesSent || 0}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <Zap className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Today</p>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Contacts</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {summary?.today.activeContacts || 0}
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Protected contacts</p>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>

        {summary?.recentActivity && summary.recentActivity.length > 0 ? (
          <div className="space-y-3">
            {summary.recentActivity.map((msg: any) => (
              <div
                key={msg._id}
                className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg"
              >
                <div className={`p-2 rounded-lg ${
                  msg.direction === 'incoming' ? 'bg-blue-100' : 'bg-green-100'
                }`}>
                  {msg.direction === 'incoming' ? (
                    <MessageCircle className="w-4 h-4 text-blue-600" />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-900">
                      {msg.contactId?.name || 'Unknown Contact'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {msg.finalText || msg.originalContent}
                  </p>
                  {msg.generatedByAI && (
                    <span className="inline-flex items-center px-2 py-1 mt-2 text-xs font-medium text-green-700 bg-green-100 rounded">
                      <Zap className="w-3 h-3 mr-1" />
                      AI Reply
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No recent activity</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;