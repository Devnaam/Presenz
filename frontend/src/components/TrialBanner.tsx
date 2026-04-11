import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertTriangle, Gift, Zap } from 'lucide-react';


// ─────────────────────────────────────────────────────────────────
// TrialBanner
//
// DROP INTO Layout.tsx — place it just inside the main content
// wrapper, ABOVE {children}, so it appears at the top of every
// dashboard page:
//
//   <div className="main-content">
//     <TrialBanner />         ← add here
//     {children}
//   </div>
// ─────────────────────────────────────────────────────────────────

type BannerConfig = {
  bg:       string;
  border:   string;
  textColor: string;
  icon:     React.ReactNode;
  message:  string;
  cta:      string;
  ctaStyle: string;
  action:   () => void;
};

const TrialBanner: React.FC = () => {
  const { isPending, isTrialActive, isExpired, isGrace, isPaid, trialDaysLeft } = useAuth();
  const navigate = useNavigate();

  // ── No banner cases ──────────────────────────────────────────
  // Paid user (non-cancelled) — no nag
  if (isPaid) return null;
  // Trial day 1–4 — don't nag early, let them use the product
  if (isTrialActive && trialDaysLeft > 4) return null;


  // ── Determine config ─────────────────────────────────────────
  let config: BannerConfig | null = null;

  if (isPending) {
    config = {
      bg:        'bg-blue-50',
      border:    'border-blue-200',
      textColor: 'text-blue-800',
      icon:      <Gift className="w-4 h-4 text-blue-500 flex-shrink-0" />,
      message:   'Your free trial is waiting — activate it to start using Presenz.',
      cta:       'Activate Trial',
      ctaStyle:  'bg-blue-600 text-white hover:bg-blue-700',
      action:    () => navigate('/onboarding'),
    };

  } else if (isTrialActive && trialDaysLeft <= 2) {
    // Day 6 or 7 — urgent
    config = {
      bg:        'bg-orange-50',
      border:    'border-orange-200',
      textColor: 'text-orange-800',
      icon:      <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />,
      message:   trialDaysLeft === 1
        ? 'Last day of your free trial. Upgrade now to keep your AI running.'
        : `${trialDaysLeft} days left in your free trial.`,
      cta:       'Upgrade Now',
      ctaStyle:  'bg-orange-500 text-white hover:bg-orange-600',
      action:    () => navigate('/subscription'),
    };

  } else if (isTrialActive && trialDaysLeft <= 4) {
    // Day 3–5 — soft warning
    config = {
      bg:        'bg-yellow-50',
      border:    'border-yellow-200',
      textColor: 'text-yellow-800',
      icon:      <Zap className="w-4 h-4 text-yellow-500 flex-shrink-0" />,
      message:   `${trialDaysLeft} days left in your free trial.`,
      cta:       'View Plans',
      ctaStyle:  'bg-white border border-yellow-400 text-yellow-700 hover:bg-yellow-50',
      action:    () => navigate('/subscription'),
    };

  } else if (isExpired) {
    config = {
      bg:        'bg-red-50',
      border:    'border-red-200',
      textColor: 'text-red-800',
      icon:      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />,
      message:   'Your trial has ended. Upgrade to keep your AI replies running.',
      cta:       'Choose a Plan',
      ctaStyle:  'bg-red-600 text-white hover:bg-red-700',
      action:    () => navigate('/subscription'),
    };

  } else if (isGrace) {
    config = {
      bg:        'bg-amber-50',
      border:    'border-amber-200',
      textColor: 'text-amber-800',
      icon:      <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />,
      message:   'Payment failed. Please update your payment method — you have a 3-day grace period.',
      cta:       'Fix Payment',
      ctaStyle:  'bg-amber-500 text-white hover:bg-amber-600',
      action:    () => navigate('/subscription'),
    };
  }

  if (!config) return null;

  return (
    <div className={`border-b px-4 py-2.5 ${config.bg} ${config.border}`}>
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          {config.icon}
          <span className={`text-sm font-medium ${config.textColor}`}>
            {config.message}
          </span>
        </div>
        <button
          onClick={config.action}
          className={`text-sm font-semibold px-4 py-1.5 rounded-full transition-all whitespace-nowrap ${config.ctaStyle}`}
        >
          {config.cta}
        </button>
      </div>
    </div>
  );
};

export default TrialBanner;