import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { activityService } from '../services/apiService';
import {
  UserPlus, Gift, Zap, Star, XCircle, AlertCircle,
  Smartphone, WifiOff, ShieldX, UserMinus, Brain,
  CheckCircle, ChevronLeft, ChevronRight, RefreshCw, Activity
} from 'lucide-react';
import toast from 'react-hot-toast';

// ── Event type → icon / color / category ─────────────────────────
const EVENT_CONFIG: Record<string, {
  icon: React.ElementType;
  bg: string;
  iconColor: string;
  category: string;
}> = {
  'account.registered':           { icon: UserPlus,    bg: 'bg-green-100',  iconColor: 'text-green-600',  category: 'Account' },
  'account.onboarded':            { icon: CheckCircle, bg: 'bg-green-100',  iconColor: 'text-green-600',  category: 'Account' },
  'subscription.trial_activated': { icon: Gift,        bg: 'bg-blue-100',   iconColor: 'text-blue-600',   category: 'Subscription' },
  'subscription.upgraded':        { icon: Zap,         bg: 'bg-purple-100', iconColor: 'text-purple-600', category: 'Subscription' },
  'subscription.cancelled':       { icon: XCircle,     bg: 'bg-amber-100',  iconColor: 'text-amber-600',  category: 'Subscription' },
  'subscription.expired':         { icon: AlertCircle, bg: 'bg-red-100',    iconColor: 'text-red-600',    category: 'Subscription' },
  'subscription.referral_earned': { icon: Gift,        bg: 'bg-green-100',  iconColor: 'text-green-600',  category: 'Subscription' },
  'whatsapp.connected':           { icon: Smartphone,  bg: 'bg-green-100',  iconColor: 'text-green-600',  category: 'WhatsApp' },
  'whatsapp.disconnected':        { icon: WifiOff,     bg: 'bg-gray-100',   iconColor: 'text-gray-500',   category: 'WhatsApp' },
  'whatsapp.rejected':            { icon: ShieldX,     bg: 'bg-red-100',    iconColor: 'text-red-600',    category: 'WhatsApp' },
  'contact.added':                { icon: UserPlus,    bg: 'bg-blue-100',   iconColor: 'text-blue-600',   category: 'Contacts' },
  'contact.removed':              { icon: UserMinus,   bg: 'bg-red-100',    iconColor: 'text-red-500',    category: 'Contacts' },
  'contact.profile_created':      { icon: Brain,       bg: 'bg-purple-100', iconColor: 'text-purple-600', category: 'Contacts' },
};

const CATEGORY_COLORS: Record<string, string> = {
  Account:      'bg-green-50 text-green-700 border border-green-200',
  Subscription: 'bg-purple-50 text-purple-700 border border-purple-200',
  WhatsApp:     'bg-blue-50 text-blue-700 border border-blue-200',
  Contacts:     'bg-gray-100 text-gray-600 border border-gray-200',
};

interface ActivityEvent {
  _id: string;
  type: string;
  title: string;
  description: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

interface Pagination {
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}

// ── Relative time ────────────────────────────────────────────────
const formatTime = (ts: string): string => {
  const d       = new Date(ts);
  const now     = new Date();
  const diffMs  = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH   = Math.floor(diffMs / 3600000);
  const diffD   = Math.floor(diffMs / 86400000);

  if (diffMin < 1)  return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffH < 24)   return `${diffH}h ago`;
  if (diffD === 1)  return 'Yesterday';
  if (diffD < 7)    return `${diffD}d ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

// ── Group events by date ─────────────────────────────────────────
const groupByDate = (events: ActivityEvent[]): Record<string, ActivityEvent[]> => {
  return events.reduce((acc, event) => {
    const d   = new Date(event.createdAt);
    const now = new Date();
    const diffD = Math.floor((now.getTime() - d.getTime()) / 86400000);
    const key   = diffD === 0 ? 'Today'
                : diffD === 1 ? 'Yesterday'
                : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    if (!acc[key]) acc[key] = [];
    acc[key].push(event);
    return acc;
  }, {} as Record<string, ActivityEvent[]>);
};



const ActivityPage: React.FC = () => {
  const { user } = useAuth();
  const [events, setEvents]         = useState<ActivityEvent[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage]             = useState(1);

  useEffect(() => { loadActivity(page); }, [page]);

  const loadActivity = async (p: number, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await activityService.getActivity(user!._id, p);
      setEvents(res.data.data.events);
      setPagination(res.data.data.pagination);
    } catch {
      toast.error('Failed to load activity');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    await loadActivity(page, true);
    toast.success('Refreshed');
  };

  const grouped = groupByDate(events);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Account Activity</h1>
          <p className="text-gray-500 text-sm mt-1">Everything that's happened on your account</p>
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

      {/* Timeline */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-20">
            <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No activity yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Your account events will appear here
            </p>
          </div>
        ) : (
          <div>
            {Object.entries(grouped).map(([dateLabel, dayEvents]) => (
              <div key={dateLabel}>
                {/* Date separator */}
                <div className="px-5 py-2.5 bg-gray-50 border-y border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {dateLabel}
                  </p>
                </div>

                {/* Events for this day */}
                <div className="divide-y divide-gray-50">
                  {dayEvents.map((event) => {
                    const config = EVENT_CONFIG[event.type] ?? {
                      icon: Activity,
                      bg: 'bg-gray-100',
                      iconColor: 'text-gray-500',
                      category: 'Other',
                    };
                    const Icon = config.icon;
                    const categoryStyle = CATEGORY_COLORS[config.category] ?? 'bg-gray-100 text-gray-500';

                    return (
                      <div
                        key={event._id}
                        className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
                      >
                        {/* Icon */}
                        <div className={`p-2.5 rounded-xl flex-shrink-0 mt-0.5 ${config.bg}`}>
                          <Icon className={`w-4 h-4 ${config.iconColor}`} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <p className="text-sm font-semibold text-gray-900">
                              {event.title}
                            </p>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${categoryStyle}`}>
                              {config.category}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 leading-relaxed">
                            {event.description}
                          </p>
                        </div>

                        {/* Time */}
                        <p className="text-xs text-gray-400 flex-shrink-0 mt-1">
                          {formatTime(event.createdAt)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {((pagination.page - 1) * 20) + 1}–{Math.min(pagination.page * 20, pagination.total)} of {pagination.total} events
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn btn-secondary flex items-center gap-1 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <span className="text-sm text-gray-600 px-2">
              {pagination.page} / {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!pagination.hasMore}
              className="btn btn-secondary flex items-center gap-1 disabled:opacity-40"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default ActivityPage;