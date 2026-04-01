import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { subscriptionService } from '../services/apiService';
import toast from 'react-hot-toast';
import { Check, Zap, Star } from 'lucide-react';


// ✅ FIX: Load Razorpay script directly — avoids react-razorpay TS2349 error
const loadRazorpayScript = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if ((window as any).Razorpay) {
      resolve((window as any).Razorpay);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve((window as any).Razorpay);
    script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
    document.body.appendChild(script);
  });
};


const Subscription: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);


  const plans = [
    {
      id: 'basic',
      name: 'Basic Plan',
      price: '₹299',
      period: '/ month',
      features: [
        'Unlimited family contacts',
        'AI replies in multiple languages',
        'Voice note transcription',
        'Auto-away detection',
        'Email support',
      ],
      icon: Zap,
      color: 'primary',
    },
    {
      id: 'pro',
      name: 'Pro Plan',
      price: '₹499',
      period: '/ month',
      features: [
        'Everything in Basic',
        'Priority AI processing',
        'Advanced analytics',
        'Custom personality training',
        '24/7 Priority support',
      ],
      icon: Star,
      color: 'purple',
      popular: true,
    },
  ];


  const handleSubscribe = async (planId: 'basic' | 'pro') => {
    setLoading(true);

    try {
      // Create order
      const orderResponse = await subscriptionService.createOrder(user!._id, planId);
      const { orderId, amount, currency } = orderResponse.data;

      // ✅ Load Razorpay dynamically
      const Razorpay = await loadRazorpayScript();

      // Open Razorpay checkout
      const options = {
        key: process.env.REACT_APP_RAZORPAY_KEY_ID || '',
        amount,
        currency,
        name: 'Presenz',
        description: `${planId === 'basic' ? 'Basic' : 'Pro'} Plan Subscription`,
        order_id: orderId,
        handler: async (response: any) => {
          try {
            // Verify payment on backend
            await subscriptionService.verifyPayment(
              user!._id,
              orderId,
              response.razorpay_payment_id,
              response.razorpay_signature,
              planId
            );

            toast.success('Subscription activated successfully!');
            window.location.reload();
          } catch (error: any) {
            toast.error('Payment verification failed');
          }
        },
        prefill: {
          name: user!.name,
          email: user!.email,
          contact: user!.phone,
        },
        theme: {
          color: '#0ea5e9',
        },
      };

      const razorpayInstance = new Razorpay(options);
      razorpayInstance.open();

    } catch (error: any) {
      toast.error('Failed to create order');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Choose Your Plan</h1>
        <p className="text-gray-600">Unlock the full power of AI-powered presence</p>
      </div>


      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {plans.map((plan) => {
          const Icon = plan.icon;
          return (
            <div
              key={plan.id}
              className={`card p-8 relative ${
                plan.popular ? 'border-2 border-purple-500 shadow-xl' : ''
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-purple-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="text-center mb-6">
                <div className={`inline-flex p-3 rounded-lg bg-${plan.color}-100 mb-4`}>
                  <Icon className={`w-8 h-8 text-${plan.color}-600`} />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                <div className="flex items-baseline justify-center">
                  <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-gray-600 ml-2">{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center text-gray-700">
                    <Check className="w-5 h-5 text-green-600 mr-3 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(plan.id as 'basic' | 'pro')}
                disabled={loading}
                className={`btn w-full ${
                  plan.popular ? 'btn-primary' : 'btn-secondary'
                }`}
              >
                {loading ? 'Processing...' : 'Subscribe Now'}
              </button>
            </div>
          );
        })}
      </div>


      <div className="max-w-2xl mx-auto">
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Money-Back Guarantee</h3>
          <p className="text-gray-600">
            Not satisfied? Get a full refund within 7 days, no questions asked. We're confident
            you'll love Presenz!
          </p>
        </div>
      </div>
    </div>
  );
};


export default Subscription;
