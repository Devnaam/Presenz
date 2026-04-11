import React, { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { statusService } from '../services/apiService';
import {
  Home, MessageCircle, Users, Settings,
  LogOut, Menu, X, User, Activity, CreditCard
} from 'lucide-react';
import { useState } from 'react';
import TrialBanner from './TrialBanner';


interface LayoutProps {
  children: React.ReactNode;
}


// ── Subscription status badge label ─────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  pending:   'Not activated',
  trial:     'Free Trial',
  active:    'Active',
  expired:   'Expired',
  grace:     'Grace period',
  cancelled: 'Cancelled',
};

const STATUS_COLOR: Record<string, string> = {
  pending:   'text-gray-400',
  trial:     'text-blue-500',
  active:    'text-green-500',
  expired:   'text-red-500',
  grace:     'text-amber-500',
  cancelled: 'text-orange-500',
};


// ─────────────────────────────────────────────────────────────────
const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout, trialDaysLeft, isTrialActive } = useAuth();
  const location       = useLocation();
  const navigate       = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);


  // ── Heartbeat — update last active every 30s ─────────────────
  useEffect(() => {
    const updateActivity = async () => {
      if (user) {
        try {
          await statusService.updateActivity(user._id);
        } catch (error) {
          console.error('Failed to update activity:', error);
        }
      }
    };

    updateActivity();
    const interval = setInterval(updateActivity, 30000);
    return () => clearInterval(interval);
  }, [user]);


  const navigation = [
    { name: 'Dashboard',     href: '/dashboard',     icon: Home          },
    { name: 'Conversations', href: '/conversations',  icon: MessageCircle },
    { name: 'Contacts',      href: '/contacts',       icon: Users         },
    { name: 'Profile',       href: '/profile',        icon: User          },
    { name: 'Settings',      href: '/settings',       icon: Settings      },
    { name: 'Activity',      href: '/activity',       icon: Activity      },
    { name: 'Subscription',  href: '/subscription',   icon: CreditCard    },
  ];


  const handleLogout = () => {
    logout();
    navigate('/login');
  };


  const statusLabel = STATUS_LABEL[user?.subscriptionStatus ?? 'pending'] ?? 'Unknown';
  const statusColor = STATUS_COLOR[user?.subscriptionStatus ?? 'pending'] ?? 'text-gray-400';

  // Trial days left shown next to status in nav
  const statusDisplay = isTrialActive && trialDaysLeft > 0
    ? `Trial · ${trialDaysLeft}d left`
    : statusLabel;


  // ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Top Navigation ── */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">

            {/* Brand */}
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-primary-600">Presenz</h1>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-1">
              {navigation.map((item) => {
                const Icon     = item.icon;
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-1.5" />
                    {item.name}
                  </Link>
                );
              })}
            </div>

            {/* User menu — desktop */}
            <div className="hidden md:flex items-center space-x-3">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900 leading-tight">
                  {user?.name}
                </p>
                <p className={`text-xs font-medium leading-tight ${statusColor}`}>
                  {statusDisplay}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>

          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200">
            <div className="px-2 pt-2 pb-3 space-y-1">

              {/* User info strip */}
              <div className="px-3 py-2 mb-1 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
                <p className={`text-xs font-medium ${statusColor}`}>{statusDisplay}</p>
              </div>

              {navigation.map((item) => {
                const Icon     = item.icon;
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center px-3 py-2 rounded-lg text-base font-medium ${
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    {item.name}
                  </Link>
                );
              })}

              <button
                onClick={handleLogout}
                className="w-full flex items-center px-3 py-2 rounded-lg text-base font-medium text-gray-700 hover:bg-gray-100"
              >
                <LogOut className="w-5 h-5 mr-3" />
                Logout
              </button>
            </div>
          </div>
        )}
      </nav>


      {/* ── Trial / Status Banner ── */}
      {/* Sits between nav and content — full width, no padding override needed */}
      <TrialBanner />


      {/* ── Main Content ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

    </div>
  );
};

export default Layout;