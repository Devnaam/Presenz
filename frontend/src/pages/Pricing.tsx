import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Gift, Zap, Star, ArrowRight } from 'lucide-react';


// ─────────────────────────────────────────────────────────────────
// Plan config — public-facing, no auth needed
// ─────────────────────────────────────────────────────────────────
const PLANS = [
  {
    id:       'trial',
    name:     'Free Trial',
    price:    '₹0',
    period:   '7 days',
    icon:     Gift,
    cta:      'Start Free Trial',
    ctaStyle: 'bg-gray-900 text-white hover:bg-gray-800',
    popular:  false,
    features: [
      '1 family contact',
      '100 AI replies per day',
      'WhatsApp auto-reply',
      'Voice note transcription',
      'Auto-away detection',
      'No credit card required',
    ],
  },
  {
    id:       'pro',
    name:     'Pro',
    price:    '₹299',
    period:   '/ month',
    icon:     Zap,
    cta:      'Get Pro',
    ctaStyle: 'bg-primary-600 text-white hover:bg-primary-700',
    popular:  false,
    features: [
      '5 family contacts',
      '500 AI replies per day',
      'WhatsApp auto-reply',
      'Voice note transcription',
      'Auto-away detection',
      'Email support',
    ],
  },
  {
    id:       'business',
    name:     'Business',
    price:    '₹999',
    period:   '/ month',
    icon:     Star,
    cta:      'Get Business',
    ctaStyle: 'bg-primary-600 text-white hover:bg-primary-700',
    popular:  true,
    features: [
      '25 family contacts',
      'Unlimited AI replies',
      'WhatsApp auto-reply',
      'Voice note transcription',
      'Priority AI processing',
      'Advanced analytics',
      '24/7 Priority support',
    ],
  },
];


// ─────────────────────────────────────────────────────────────────
// Component — fully public, no auth
// ─────────────────────────────────────────────────────────────────
const Pricing: React.FC = () => {
  const navigate = useNavigate();

  const handleCTA = (planId: string) => {
    // All CTAs go to register — plan selection happens after trial activation
    navigate('/register');
  };

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Minimal nav ── */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="text-xl font-bold text-gray-900"
        >
          Presenz
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/login')}
            className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors"
          >
            Log in
          </button>
          <button
            onClick={() => navigate('/register')}
            className="btn btn-primary text-sm"
          >
            Get started
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-16">

        {/* ── Header ── */}
        <div className="text-center mb-14">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Simple, honest pricing
          </h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            Start free. Upgrade when you're ready. No hidden fees.
          </p>
        </div>

        {/* ── Plan cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-14">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            return (
              <div
                key={plan.id}
                className={`relative bg-white rounded-2xl p-7 flex flex-col ${
                  plan.popular
                    ? 'border-2 border-primary-500 shadow-xl'
                    : 'border border-gray-200 shadow-sm'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-primary-600 text-white text-xs font-bold px-4 py-1.5 rounded-full tracking-wide uppercase">
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Plan meta */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className={`w-5 h-5 ${plan.popular ? 'text-primary-600' : 'text-gray-600'}`} />
                    <span className="font-semibold text-gray-900">{plan.name}</span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                    <span className="text-gray-500 text-sm">{plan.period}</span>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-sm text-gray-700">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <button
                  onClick={() => handleCTA(plan.id)}
                  className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${plan.ctaStyle}`}
                >
                  {plan.cta}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>

        {/* ── FAQ strip ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center mb-14">
          {[
            { q: 'Do I need a credit card?',  a: 'No. The 7-day trial is completely free with no card required.' },
            { q: 'Can I cancel anytime?',     a: 'Yes. Cancel from your dashboard at any time. No lock-ins.' },
            { q: 'Is my WhatsApp safe?',      a: 'Yes. We use WhatsApp\'s official linked device protocol.' },
          ].map((item, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm font-semibold text-gray-900 mb-1.5">{item.q}</p>
              <p className="text-sm text-gray-500 leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>

        {/* ── Bottom CTA ── */}
        <div className="text-center">
          <p className="text-gray-500 text-sm mb-3">
            7-day money-back guarantee · Secure payments via Razorpay
          </p>
          <button
            onClick={() => navigate('/register')}
            className="btn btn-primary px-8 py-3 text-base font-semibold"
          >
            Start your free trial →
          </button>
        </div>

      </div>
    </div>
  );
};

export default Pricing;