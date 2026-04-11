import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { subscriptionService } from '../services/apiService';
import toast from 'react-hot-toast';
import {
  Check, Zap, Star, Gift,
  BarChart2,
  Users, MessageSquare,
} from 'lucide-react';
import UpgradeModal from '../components/UpgradeModal';


// ─────────────────────────────────────────────────────────────────
// Razorpay loader (same utility, kept local to avoid circular deps)
// ─────────────────────────────────────────────────────────────────
const loadRazorpayScript = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if ((window as any).Razorpay) { resolve((window as any).Razorpay); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve((window as any).Razorpay);
    script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
    document.body.appendChild(script);
  });
};


// ─────────────────────────────────────────────────────────────────
// Plan config
// ─────────────────────────────────────────────────────────────────
const PLANS = [
  {
    id: 'pro' as const,
    name: 'Pro',
    price: '₹299',
    period: '/ month',
    icon: Zap,
    popular: false,
    features: [
      '5 family contacts',
      '500 AI replies per day',
      'Voice note transcription',
      'Auto-away detection',
      'Email support',
    ],
  },
  {
    id: 'business' as const,
    name: 'Business',
    price: '₹999',
    period: '/ month',
    icon: Star,
    popular: true,
    features: [
      '25 family contacts',
      'Unlimited AI replies',
      'Priority AI processing',
      'Advanced analytics',
      '24/7 Priority support',
    ],
  },
];


// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────
const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
};

const PLAN_LABELS: Record<string, string> = {
  trial: 'Free Trial',
  pro: 'Pro',
  business: 'Business',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Not activated', color: 'text-gray-500 bg-gray-100' },
  trial: { label: 'Trial active', color: 'text-blue-700 bg-blue-100' },
  active: { label: 'Active', color: 'text-green-700 bg-green-100' },
  expired: { label: 'Expired', color: 'text-red-700 bg-red-100' },
  grace: { label: 'Grace period', color: 'text-amber-700 bg-amber-100' },
  cancelled: { label: 'Cancels at period end', color: 'text-amber-700 bg-amber-100' },
};


// ─────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────
const Subscription: React.FC = () => {
  const {
    user,
    updateUser,
    isPending,
    isTrialActive,
    isPaid,
    isExpired,
    isGrace,
    trialDaysLeft,
    planLimits,
  } = useAuth();

  const navigate = useNavigate();
  const [referralCode, setReferralCode] = useState('');
  const [trialActivating, setTrialActivating] = useState(false);

  const [subData, setSubData] = useState<any>(null);
  const [_subLoading, setSubLoading] = useState(true);
  const [payLoading, setPayLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);


  // ── Fetch subscription details on mount ──────────────────────
  useEffect(() => {
    const fetchSub = async () => {
      if (!user) return;
      try {
        const res = await subscriptionService.getSubscription(user._id);
        setSubData(res.data);
      } catch {
        // Non-critical
      }
      setSubLoading(false)
    };
    fetchSub();
  }, [user]);


  // ── Activate free trial ──────────────────────────────────────
  const handleActivateTrial = async () => {
    if (!user) return;
    setTrialActivating(true);
    try {
      const response = await subscriptionService.activateTrial(
        user._id,
        referralCode.trim() || undefined
      );
      updateUser({
        subscriptionStatus: 'trial',
        trialEndsAt: response.data.trialEndsAt,
        plan: 'trial',
      });
      toast.success('Trial activated! Welcome to Presenz 🎉');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to activate trial');
    } finally {
      setTrialActivating(false);
    }
  };


  // ── Subscribe (Pro / Business) ───────────────────────────────
  const handleSubscribe = async (planId: 'pro' | 'business') => {
    if (!user) return;
    setPayLoading(true);

    try {
      const orderRes = await subscriptionService.createOrder(user._id, planId);
      const { orderId, amount, currency } = orderRes.data;

      const Razorpay = await loadRazorpayScript();

      const options = {
        key: process.env.REACT_APP_RAZORPAY_KEY_ID || '',
        amount,
        currency,
        name: 'Presenz',
        description: `${planId === 'pro' ? 'Pro' : 'Business'} Plan — Monthly`,
        order_id: orderId,
        handler: async (response: any) => {
          try {
            await subscriptionService.verifyPayment(
              user._id,
              orderId,
              response.razorpay_payment_id,
              response.razorpay_signature,
              planId
            );

            updateUser({ subscriptionStatus: 'active', plan: planId });
            toast.success('Subscription activated! 🎉');

            // Refresh subscription data
            const refreshed = await subscriptionService.getSubscription(user._id);
            setSubData(refreshed.data);
          } catch {
            toast.error('Payment verification failed. Contact support if amount was deducted.');
          } finally {
            setPayLoading(false);
          }
        },
        prefill: {
          name: user.name,
          email: user.email,
          contact: user.phone,
        },
        theme: { color: '#0ea5e9' },
        modal: { ondismiss: () => setPayLoading(false) },
      };

      const rzp = new Razorpay(options);
      rzp.open();

    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create order');
      setPayLoading(false);
    }
  };


  // ── Cancel subscription ──────────────────────────────────────
  const handleCancel = async () => {
    if (!user) return;

    const confirmed = window.confirm(
      'Cancel your subscription? You can continue using Presenz until your current billing period ends.'
    );
    if (!confirmed) return;

    setCancelLoading(true);
    try {
      await subscriptionService.cancelSubscription(user._id);
      updateUser({ subscriptionStatus: 'cancelled' });
      toast.success('Subscription cancelled. Access continues until your billing period ends.');

      const refreshed = await subscriptionService.getSubscription(user._id);
      setSubData(refreshed.data);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to cancel subscription');
    } finally {
      setCancelLoading(false);
    }
  };


  if (!user) return null;

  const statusConfig = STATUS_LABELS[user.subscriptionStatus] ?? STATUS_LABELS['pending'];
  const planLabel = PLAN_LABELS[user.plan] ?? 'Free Trial';
  const isCancelled = user.subscriptionStatus === 'cancelled';


  // ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 max-w-4xl mx-auto">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Subscription</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your plan and billing</p>
      </div>

      {/* ── Trial activation — only shown when PENDING ── */}
      {isPending && (
        <div className="card p-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Gift className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Your free trial is ready!
            </h2>
            <p className="text-gray-500 text-sm">7 days free. No credit card required.</p>
          </div>

          {/* Feature list */}
          <div className="space-y-3 mb-8">
            {[
              'WhatsApp AI replies — your words, your tone',
              '1 family contact during your trial',
              'Up to 100 AI replies per day',
              'Auto-away detection when you\'re busy',
              'No credit card required — cancel anytime',
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-green-600" />
                </div>
                <span className="text-sm text-gray-700">{feature}</span>
              </div>
            ))}
          </div>

          {/* Referral code */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Referral code{' '}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={referralCode}
              onChange={(e) =>
                setReferralCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
              }
              placeholder="e.g. X7KP2R"
              maxLength={6}
              className="input uppercase tracking-widest font-mono"
            />
            <p className="text-xs text-gray-400 mt-1">
              Enter a friend's code — both of you get +7 bonus days free
            </p>
          </div>

          {/* CTA */}
          <button
            onClick={handleActivateTrial}
            disabled={trialActivating}
            className="btn btn-primary w-full py-3 text-base font-semibold"
          >
            {trialActivating ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Activating...
              </span>
            ) : (
              'Activate My Free Trial →'
            )}
          </button>

          <p className="text-center text-xs text-gray-400 mt-4">
            By activating, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      )}


      {/* ── Current plan card ── */}
      <div className="card p-6">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-lg font-bold text-gray-900">{planLabel} Plan</h2>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusConfig.color}`}>
                {statusConfig.label}
              </span>
            </div>
            {isTrialActive && (
              <p className="text-sm text-gray-500">
                Trial ends on {formatDate(user.trialEndsAt)} · {trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''} left
              </p>
            )}
            {(isPaid || isCancelled) && subData?.subscription?.currentPeriodEnd && (
              <p className={`text-sm ${isCancelled ? 'text-amber-600' : 'text-gray-500'}`}>
                {isCancelled
                  ? `⚠️ Full access until ${formatDate(subData.subscription.currentPeriodEnd)}`
                  : `Renews on ${formatDate(subData.subscription.currentPeriodEnd)}`
                }
              </p>
            )}
            {isExpired && (
              <p className="text-sm text-red-500">Your plan has expired. Upgrade to restore access.</p>
            )}
            {isGrace && (
              <p className="text-sm text-amber-600">
                Payment failed — grace period ends {formatDate(subData?.subscription?.gracePeriodEndsAt)}
              </p>
            )}
          </div>

          {/* Upgrade CTA — shown if not on Business plan */}
          {!isPaid && !isCancelled && (
            <button onClick={() => setUpgradeOpen(true)} className="btn btn-primary text-sm">
              Upgrade Plan
            </button>
          )}
        </div>

        {/* Usage stats */}
        {!isPending && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-500 font-medium">Contacts</span>
              </div>
              <p className="text-lg font-bold text-gray-900">
                {planLimits.contacts === 999999 ? 'Unlimited' : planLimits.contacts}
              </p>
              <p className="text-xs text-gray-400">allowed on this plan</p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-500 font-medium">AI Replies</span>
              </div>
              <p className="text-lg font-bold text-gray-900">
                {planLimits.repliesPerDay === 999999 ? 'Unlimited' : planLimits.repliesPerDay}
              </p>
              <p className="text-xs text-gray-400">per day</p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <BarChart2 className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-500 font-medium">Used Today</span>
              </div>
              <p className="text-lg font-bold text-gray-900">
                {user.repliesUsedToday ?? 0}
              </p>
              <p className="text-xs text-gray-400">replies sent</p>
            </div>
          </div>
        )}

        {/* Referral code */}
        {user.referralCode && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-sm font-medium text-gray-700">Your referral code</p>
                <p className="text-xs text-gray-400">Share it — both of you get +7 free days</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-lg tracking-widest text-primary-600 bg-primary-50 border border-primary-200 px-4 py-1.5 rounded-lg">
                  {user.referralCode}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(user.referralCode);
                    toast.success('Referral code copied!');
                  }}
                  className="btn btn-secondary text-xs py-1.5"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        )}
      </div>


      {/* ── Upgrade plan cards — only shown if not on Business ── */}
      {user.plan !== 'business' && (
        <div>
          <h2 className="text-base font-bold text-gray-900 mb-4">Available Plans</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {PLANS.map((plan) => {
              const Icon = plan.icon;
              const isCurrentPlan = user.plan === plan.id && isPaid;

              return (
                <div
                  key={plan.id}
                  className={`card p-6 relative ${plan.popular
                    ? 'border-2 border-primary-500'
                    : 'border border-gray-200'
                    }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span className="bg-primary-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                        Most Popular
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-3 mb-5">
                    <div className={`p-2 rounded-lg ${plan.popular ? 'bg-primary-100' : 'bg-gray-100'}`}>
                      <Icon className={`w-5 h-5 ${plan.popular ? 'text-primary-600' : 'text-gray-600'}`} />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{plan.name} Plan</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-gray-900">{plan.price}</span>
                        <span className="text-sm text-gray-500">{plan.period}</span>
                      </div>
                    </div>
                  </div>

                  <ul className="space-y-2.5 mb-6">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {isCurrentPlan ? (
                    <div className="w-full py-2.5 rounded-xl text-sm font-semibold text-center bg-gray-100 text-gray-500 cursor-default">
                      Current Plan
                    </div>
                  ) : (
                    <button
                      onClick={() => handleSubscribe(plan.id)}
                      disabled={payLoading}
                      className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${plan.popular
                        ? 'bg-primary-600 text-white hover:bg-primary-700'
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {payLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Processing...
                        </span>
                      ) : (
                        `Get ${plan.name} Plan`
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}


      {/* ── Money-back guarantee ── */}
      <div className="card p-5 flex items-start gap-3">
        <Gift className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-gray-900">7-day money-back guarantee</p>
          <p className="text-sm text-gray-500 mt-0.5">
            Not satisfied? Get a full refund within 7 days — no questions asked.
          </p>
        </div>
      </div>


      {/* ── Cancel section — only for active paid plans ── */}
      {isPaid && !subData?.subscription?.cancelledAt && (
        <div className="card p-5 border border-red-100">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">Cancel subscription</p>
              <p className="text-sm text-gray-500 mt-0.5">
                You'll keep access until your current billing period ends.
              </p>
            </div>
            <button
              onClick={handleCancel}
              disabled={cancelLoading}
              className="text-sm font-medium text-red-600 hover:text-red-700 underline underline-offset-2 transition-colors disabled:opacity-50"
            >
              {cancelLoading ? 'Cancelling...' : 'Cancel subscription'}
            </button>
          </div>
        </div>
      )}


      {/* Upgrade modal */}
      <UpgradeModal
        isOpen={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        reason="default"
      />

    </div>
  );
};

export default Subscription;