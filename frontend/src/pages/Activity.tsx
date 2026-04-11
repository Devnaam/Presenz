import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { activityService } from '../services/apiService';
import {
  Zap, MessageCircle, RefreshCw, ChevronLeft,
  ChevronRight, UserCheck
} from 'lucide-react';
import toast from 'react-hot-toast';


type Filter = 'all' | 'ai' | 'override';

interface ActivityMessage {
  _id: string;
  contactId: { name: string; relation: string; phone: string } | null;
  finalText: string;
  originalContent: string;
  generatedByAI: boolean;
  studentOverride: boolean;
  language: string;
  timestamp: string;
  type: string;
}

interface Stats {
  totalAI: number;
  todayAI: number;
  overridden: number;
}

interface Pagination {
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}


const Activity: React.FC = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ActivityMessage[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadStats();
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadLog(page, filter);
  }, [page, filter]);

  const loadStats = async () => {
    try {
      const res = await activityService.getStats(user!._id);
      setStats(res.data.data);
    } catch {
      // stats are non-critical — fail silently
    }
  };


  const loadLog = async (p: number, f: Filter, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await activityService.getLog(user!._id, p, f);
      setMessages(res.data.data.messages);
      setPagination(res.data.data.pagination);
    } catch (error: any) {
      toast.error('Failed to load activity log');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };


  const handleFilterChange = (f: Filter) => {
    setFilter(f);
    setPage(1); // reset to first page on filter change
  };


  const handleRefresh = async () => {
    await Promise.all([
      loadStats(),
      loadLog(page, filter, true),
    ]);
    toast.success('Refreshed');
  };


  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };


  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">AI Activity Log</h1>
          <p className="text-gray-600 mt-1">Every reply your AI has sent</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="btn btn-secondary flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>


      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total AI Replies</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalAI}</p>
              </div>
              <div className="p-3 bg-primary-100 rounded-lg">
                <Zap className="w-6 h-6 text-primary-600" />
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Sent Today</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.todayAI}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <MessageCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">You Overrode</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.overridden}</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <UserCheck className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Filter Tabs */}
      <div className="flex bg-gray-100 rounded-lg p-1 gap-1 w-fit">
        {([
          { value: 'all', label: '⚡ All AI Replies' },
          { value: 'override', label: '✏️ You Overrode' },
        ] as { value: Filter; label: string }[]).map((f) => (
          <button
            key={f.value}
            onClick={() => handleFilterChange(f.value)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${filter === f.value
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            {f.label}
          </button>
        ))}
      </div>


      {/* Log */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-16">
            <Zap className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No AI replies yet</p>
            <p className="text-sm text-gray-500 mt-1">
              Set your status to Away and let AI handle messages
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {messages.map((msg) => (
              <div key={msg._id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">

                    {/* Icon */}
                    <div className={`p-2 rounded-lg flex-shrink-0 mt-0.5 ${msg.studentOverride ? 'bg-yellow-100' : 'bg-primary-100'
                      }`}>
                      {msg.studentOverride
                        ? <UserCheck className="w-4 h-4 text-yellow-600" />
                        : <Zap className="w-4 h-4 text-primary-600" />
                      }
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Contact + badges row */}
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-medium text-gray-900 text-sm">
                          {msg.contactId?.name || 'Unknown Contact'}
                        </p>
                        {msg.contactId?.relation && (
                          <span className="text-xs text-gray-500">
                            · {msg.contactId.relation}
                          </span>
                        )}
                        {msg.studentOverride && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">
                            You overrode
                          </span>
                        )}
                        {msg.language && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                            {msg.language}
                          </span>
                        )}
                      </div>

                      {/* Message text */}
                      <p className="text-sm text-gray-800 leading-relaxed">
                        {msg.finalText || msg.originalContent}
                      </p>
                    </div>
                  </div>

                  {/* Timestamp */}
                  <p className="text-xs text-gray-400 flex-shrink-0 mt-1">
                    {formatTime(msg.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>


      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Showing {((pagination.page - 1) * 20) + 1}–{Math.min(pagination.page * 20, pagination.total)} of {pagination.total} replies
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn btn-secondary flex items-center gap-1 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
            </button>
            <span className="text-sm text-gray-700 px-2">
              {pagination.page} / {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!pagination.hasMore}
              className="btn btn-secondary flex items-center gap-1 disabled:opacity-40"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
};


export default Activity;