import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { subscriptionService } from '../services/apiService';
import toast from 'react-hot-toast';
import { X, Check, Zap, Star } from 'lucide-react';


// ─────────────────────────────────────────────────────────────────
// Razorpay script loader
// ─────────────────────────────────────────────────────────────────
const loadRazorpayScript = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if ((window as any).Razorpay) {
      resolve((window as any).Razorpay);
      return;
    }
    const script   = document.createElement('script');
    script.src     = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload  = () => resolve((window as any).Razorpay);
    script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
    document.body.appendChild(script);
  });
};


// ─────────────────────────────────────────────────────────────────
// Reason → header copy
// ─────────────────────────────────────────────────────────────────
const REASON_COPY: Record<string, { title: string; subtitle: string }> = {
  CONTACT_LIMIT_REACHED: {
    title:    'Add more contacts',
    subtitle: "You've reached the contact limit on your current plan.",
  },
  REPLY_LIMIT_REACHED: {
    title:    'Daily reply limit reached',
    subtitle: "You've used all your AI replies for today. Upgrade for more.",
  },
  TRIAL_EXPIRED: {
    title:    'Your trial has ended',
    subtitle: 'Choose a plan to keep your AI running without interruption.',
  },
  SUBSCRIPTION_REQUIRED: {
    title:    'Subscription required',
    subtitle: 'Start a plan to unlock AI-powered WhatsApp replies.',
  },
  default: {
    title:    'Upgrade your plan',
    subtitle: 'Unlock more contacts, more replies, and priority support.',
  },
};


// ─────────────────────────────────────────────────────────────────
// Plan config
// ─────────────────────────────────────────────────────────────────
const PLANS = [
  {
    id:       'pro' as const,
    name:     'Pro',
    price:    '₹299',
    period:   '/ month',
    icon:     Zap,
    popular:  false,
    features: [
      '5 family contacts',
      '500 AI replies per day',
      'Voice note transcription',
      'Auto-away detection',
      'Email support',
    ],
  },
  {
    id:       'business' as const,
    name:     'Business',
    price:    '₹999',
    period:   '/ month',
    icon:     Star,
    popular:  true,
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
// Props
// ─────────────────────────────────────────────────────────────────
interface UpgradeModalProps {
  isOpen:  boolean;
  onClose: () => void;
  reason?: string;   // one of the REASON_COPY keys — controls header copy
}


// ─────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────
const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose, reason }) => {
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);

  const copy = REASON_COPY[reason ?? 'default'] ?? REASON_COPY['default'];

  if (!isOpen) return null;


  // ── Razorpay checkout ────────────────────────────────────────
  const handleSubscribe = async (planId: 'pro' | 'business') => {
    if (!user) return;
    setLoading(true);

    try {
      // 1. Create order on backend
      const orderRes = await subscriptionService.createOrder(user._id, planId);
      const { orderId, amount, currency } = orderRes.data;

      // 2. Load Razorpay SDK
      const Razorpay = await loadRazorpayScript();

      // 3. Open checkout
      const options = {
        key:         process.env.REACT_APP_RAZORPAY_KEY_ID || '',
        amount,
        currency,
        name:        'Presenz',
        description: `${planId === 'pro' ? 'Pro' : 'Business'} Plan — Monthly`,
        order_id:    orderId,
        handler: async (response: any) => {
          try {
            // 4. Verify on backend
            await subscriptionService.verifyPayment(
              user._id,
              orderId,
              response.razorpay_payment_id,
              response.razorpay_signature,
              planId
            );

            // 5. Sync user state
            updateUser({
              subscriptionStatus: 'active',
              plan:               planId,
            });

            toast.success('Subscription activated! Welcome to Presenz 🎉');
            onClose();
          } catch {
            toast.error('Payment verification failed. Contact support if amount was deducted.');
          }
        },
        prefill: {
          name:    user.name,
          email:   user.email,
          contact: user.phone,
        },
        theme: {
          color: '#0ea5e9',
        },
        modal: {
          // Don't close the upgrade modal if Razorpay is dismissed
          ondismiss: () => setLoading(false),
        },
      };

      const rzpInstance = new Razorpay(options);
      rzpInstance.open();

    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create order. Please try again.');
      setLoading(false);
    }
  };


  // ── Render ───────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-gray-100">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{copy.title}</h2>
              <p className="text-sm text-gray-500 mt-1">{copy.subtitle}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors ml-4 flex-shrink-0"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Plan cards */}
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PLANS.map((plan) => {
              const Icon = plan.icon;
              return (
                <div
                  key={plan.id}
                  className={`relative rounded-xl border-2 p-6 flex flex-col ${
                    plan.popular
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  {/* Popular badge */}
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-primary-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                        Most Popular
                      </span>
                    </div>
                  )}

                  {/* Plan header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2 rounded-lg ${plan.popular ? 'bg-primary-100' : 'bg-gray-100'}`}>
                      <Icon className={`w-5 h-5 ${plan.popular ? 'text-primary-600' : 'text-gray-600'}`} />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{plan.name}</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-bold text-gray-900">{plan.price}</span>
                        <span className="text-xs text-gray-500">{plan.period}</span>
                      </div>
                    </div>
                  </div>

                  {/* Features */}
                  <ul className="space-y-2 mb-6 flex-1">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <button
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={loading}
                    className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      plan.popular
                        ? 'bg-primary-600 text-white hover:bg-primary-700'
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {loading ? 'Processing...' : `Get ${plan.name}`}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 text-center">
            <p className="text-xs text-gray-400">
              7-day money-back guarantee · Cancel anytime · Secure payment via Razorpay
            </p>
          </div>

        </div>
      </div>
    </>
  );
};

export default UpgradeModal;