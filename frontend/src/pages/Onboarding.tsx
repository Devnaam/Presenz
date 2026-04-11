import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { sessionService, profileService } from '../services/apiService';
import { UserCircle, CheckCircle, RefreshCw, Wifi } from 'lucide-react';


// ─────────────────────────────────────────────────────────────────
// Live preview samples — purely client-side, zero API calls
// ─────────────────────────────────────────────────────────────────
const PREVIEW_SAMPLES: Record<string, Record<string, Record<string, string>>> = {
  auto: {
    casual: { short: 'haan kha liya maa 😅', medium: 'haan maa kha liya, thoda late hua bas. tu bata kha liya?', match: 'haan kha liya maa, chill 😄' },
    friendly: { short: 'haan maa, kha liya ❤️', medium: 'haan kha liya maa, bilkul chinta mat kar. tune bhi kha liya na?', match: 'haan kha liya maa, bilkul chinta mat kar' },
    professional: { short: 'Haan Maa, khana ho gaya.', medium: 'Haan Maa, khana kha liya. Aaj ka din kaafi busy tha. Aap bhi kha lo.', match: 'Haan Maa, khana ho gaya.' },
  },
  hinglish: {
    casual: { short: 'haan kha liya maa 😅', medium: 'haan maa kha liya, thoda late hua bas. tu bata?', match: 'haan kha liya maa, chill 😄' },
    friendly: { short: 'haan maa, kha liya ❤️', medium: 'haan kha liya maa, bilkul chinta mat kar. tune bhi kha liya na?', match: 'haan kha liya maa, bilkul chinta mat kar' },
    professional: { short: 'Haan Maa, khana ho gaya.', medium: 'Haan Maa, khana kha liya. Bahut acha tha. Aap bhi zaroor khana.', match: 'Haan Maa, khana ho gaya.' },
  },
  english: {
    casual: { short: 'Yeah mom, ate already!', medium: "Yeah just had lunch! Was pretty good today. You eat?", match: 'Yeah mom ate already lol' },
    friendly: { short: 'Yes mom, had my food 😊', medium: 'Yes mom, just finished eating! Hope you had something too 😊', match: 'Yes mom, had my food 😊' },
    professional: { short: 'Yes, I have had my meal.', medium: 'Yes, I have had my meal. Thank you for checking in. Hope you ate well.', match: 'Yes, I have had my meal.' },
  },
  hindi: {
    casual: { short: 'हाँ माँ, खा लिया 😄', medium: 'हाँ माँ खा लिया, थोड़ी देर हुई बस। तुमने खाया?', match: 'हाँ माँ, खा लिया 😄' },
    friendly: { short: 'हाँ माँ, खाना हो गया ❤️', medium: 'हाँ माँ खा लिया। बिल्कुल चिंता मत करो। आपने खाया?', match: 'हाँ माँ, खाना हो गया ❤️' },
    professional: { short: 'हाँ माँ, भोजन हो गया।', medium: 'हाँ माँ, भोजन हो गया। आज व्यस्त था। आप भी अवश्य भोजन करें।', match: 'हाँ माँ, भोजन हो गया।' },
  },
  tamil: {
    casual: { short: 'ஆமா அம்மா, சாப்பிட்டேன் 😄', medium: 'ஆமா சாப்பிட்டேன், கொஞ்சம் லேட் ஆச்சு. நீ சாப்பிட்டியா?', match: 'ஆமா அம்மா, சாப்பிட்டேன் 😄' },
    friendly: { short: 'ஆமா அம்மா, சாப்பிட்டாச்சு ❤️', medium: 'ஆமா சாப்பிட்டேன் அம்மா. கவலைப்படாதே. நீயும் சாப்பிட்டியா?', match: 'ஆமா அம்மா, சாப்பிட்டாச்சு ❤️' },
    professional: { short: 'ஆம் அம்மா, சாப்பிட்டேன்.', medium: 'ஆம் அம்மா, சாப்பாடு முடிந்தது. நீங்களும் சாப்பிடுங்கள்.', match: 'ஆம் அம்மா, சாப்பிட்டேன்.' },
  },
};

const getPreview = (lang: string, tone: string, length: string): string =>
  PREVIEW_SAMPLES[lang]?.[tone]?.[length] ||
  PREVIEW_SAMPLES['auto']['friendly']['match'];


// ─────────────────────────────────────────────────────────────────
// Option configs — UNCHANGED
// ─────────────────────────────────────────────────────────────────
const LANGUAGE_OPTIONS = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'hinglish', label: 'Hinglish' },
  { value: 'english', label: 'English' },
  { value: 'hindi', label: 'Hindi' },
  { value: 'tamil', label: 'Tamil' },
];

const TONE_OPTIONS = [
  { value: 'casual', label: 'Casual', desc: 'Like texting a best friend' },
  { value: 'friendly', label: 'Friendly', desc: 'Warm and caring, not too formal' },
  { value: 'professional', label: 'Professional', desc: 'Polite and composed, complete sentences' },
];

const LENGTH_OPTIONS = [
  { value: 'short', label: 'Short', desc: '1–2 sentences' },
  { value: 'medium', label: 'Medium', desc: '3–4 sentences' },
  { value: 'match', label: 'Match input', desc: 'Mirror what they sent' },
];




// ─────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────
const Onboarding: React.FC = () => {
  const { user, setOnboardingComplete } = useAuth();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1 — WhatsApp
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<'idle' | 'pending_qr' | 'connected'>('idle');
  const [qrLoading, setQrLoading] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 2 — About You
  const [aboutMe, setAboutMe] = useState('');
  const [aiLanguage, setAiLanguage] = useState('auto');
  const [aiTone, setAiTone] = useState('friendly');
  const [aiLength, setAiLength] = useState('match');

  // Step 3 — Activate Trial


  // ── Check if session already connected on mount ───────────────
  useEffect(() => {
    const checkExisting = async () => {
      try {
        const res = await sessionService.getStatus(user!._id);
        if (res?.data?.status === 'connected' || res?.status === 'connected') {
          setSessionStatus('connected');
        }
      } catch {
        // no session yet — stay idle
      }
    };
    checkExisting();
  }, [user]);

  // ── Cleanup on unmount ────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);


  // ── Step 1: Generate QR ───────────────────────────────────────
  const handleGenerateQR = async () => {
    setQrLoading(true);
    try {
      await sessionService.createSession(user!._id);
      setSessionStatus('pending_qr');
      startPolling();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create session');
    } finally {
      setQrLoading(false);
    }
  };

  const startPolling = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      try {
        const res = await sessionService.getQR(user!._id);
        const data = res?.data || res;

        if (data?.status === 'connected') {
          clearInterval(pollingRef.current!);
          clearTimeout(timeoutRef.current!);
          setSessionStatus('connected');
          toast.success('WhatsApp connected!');
          setTimeout(() => setCurrentStep(2), 1500);
        } else if (data?.qrCode) {
          setQrCode(data.qrCode);
          setSessionStatus('pending_qr');
        }
      } catch {
        clearInterval(pollingRef.current!);
        setSessionStatus('idle');
        toast.error('Session polling failed. Please try again.');
      }
    }, 3000);

    timeoutRef.current = setTimeout(() => {
      clearInterval(pollingRef.current!);
      if (sessionStatus !== 'connected') {
        setSessionStatus('idle');
        setQrCode(null);
        toast.error('QR expired. Please generate a new one.');
      }
    }, 5 * 60 * 1000);
  };


  // ── Step 2: Save profile → go to Step 3 ──────────────────────
  // Does NOT complete onboarding yet — that happens in Step 3
  const handleSaveProfile = async () => {
    if (aboutMe.trim().length < 20) {
      toast.error('Please write at least 20 characters about yourself');
      return;
    }
    setLoading(true);
    try {
      await profileService.updateProfile(user!._id, {
        aboutMe: aboutMe.trim(),
        aiLanguage,
        aiTone,
        aiLength,
      });
      setOnboardingComplete(true);          // ← NEW
      toast.success('Profile saved! Welcome to Presenz 🎉');  // ← NEW
      navigate('/dashboard');               // ← NEW
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };



  // ── Step 3: Activate Trial → dashboard ───────────────────────


  const charCount = aboutMe.length;
  const charLimit = 280;
  const canSubmit = aboutMe.trim().length >= 20 && !loading;


  // ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-12 px-4">
      <div className="w-full max-w-lg">


        {/* Brand */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Presenz</h1>
          <p className="text-gray-500 text-sm mt-1">Set up your AI assistant in 3 quick steps</p>
        </div>


        {/* ── Step Indicators (3 steps) ── */}
        <div className="flex items-center mb-8">
          {[
            { num: 1, label: 'Connect WhatsApp' },
            { num: 2, label: 'About You' },
            
          ].map((step, idx) => (
            <React.Fragment key={step.num}>
              <div className="flex flex-col items-center flex-1">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${currentStep > step.num
                    ? 'bg-green-500 text-white'
                    : currentStep === step.num
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 text-gray-400'
                  }`}>
                  {currentStep > step.num
                    ? <CheckCircle className="w-5 h-5" />
                    : step.num}
                </div>
                <span className={`text-xs mt-1 font-medium ${currentStep === step.num ? 'text-primary-600' : 'text-gray-400'
                  }`}>
                  {step.label}
                </span>
              </div>

              {/* Connector line — shown between steps */}
              {idx < 1 && (
                <div className={`flex-1 h-0.5 mb-5 mx-2 transition-all ${currentStep > step.num ? 'bg-green-400' : 'bg-gray-200'
                  }`} />
              )}
            </React.Fragment>
          ))}
        </div>


        {/* ── STEP 1: Connect WhatsApp ── */}
        {currentStep === 1 && (
          <div className="card p-8">

            {sessionStatus === 'connected' && (
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">WhatsApp Connected!</h2>
                <p className="text-gray-500 text-sm">Taking you to the next step...</p>
              </div>
            )}

            {sessionStatus === 'idle' && (
              <div className="text-center">
                <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Wifi className="w-8 h-8 text-primary-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Connect WhatsApp</h2>
                <p className="text-gray-500 text-sm mb-6">
                  Presenz links to your WhatsApp so AI can reply on your behalf when you're away.
                  Takes about 30 seconds.
                </p>
                <button
                  onClick={handleGenerateQR}
                  disabled={qrLoading}
                  className="btn btn-primary w-full"
                >
                  {qrLoading
                    ? <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating session...
                    </span>
                    : 'Generate QR Code'
                  }
                </button>
              </div>
            )}

            {sessionStatus === 'pending_qr' && (
              <div className="text-center">
                <h2 className="text-xl font-bold text-gray-900 mb-1">Scan with WhatsApp</h2>
                <p className="text-gray-500 text-sm mb-5">
                  Open WhatsApp → Settings → Linked Devices → Link a Device
                </p>

                {qrCode ? (
                  <div className="inline-block p-3 border-2 border-gray-200 rounded-xl mb-4 bg-white">
                    <img
                      src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                      alt="WhatsApp QR Code"
                      className="w-56 h-56"
                    />
                  </div>
                ) : (
                  <div className="w-56 h-56 mx-auto border-2 border-gray-200 rounded-xl bg-gray-50 flex items-center justify-center mb-4">
                    <span className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}

                <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Waiting for scan... QR refreshes automatically
                </div>

                <button
                  onClick={() => {
                    setSessionStatus('idle');
                    setQrCode(null);
                    if (pollingRef.current) clearInterval(pollingRef.current);
                  }}
                  className="btn btn-secondary w-full mt-5 text-sm"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}


        {/* ── STEP 2: About You ── */}
        {currentStep === 2 && (
          <div className="space-y-5">

            {/* Section A — Identity */}
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-primary-50 rounded-full flex items-center justify-center">
                  <UserCircle className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Who are you?</h2>
                  <p className="text-xs text-gray-500">AI uses this to represent you in every reply</p>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
                <input
                  type="text"
                  value={user?.name || ''}
                  readOnly
                  className="input bg-gray-50 text-gray-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  About Me
                  <span className="text-red-400 ml-0.5">*</span>
                </label>
                <textarea
                  value={aboutMe}
                  onChange={(e) => setAboutMe(e.target.value.slice(0, charLimit))}
                  rows={4}
                  className="input resize-none"
                  placeholder={`I'm ${user?.name?.split(' ')[0] || 'Rahul'}, 2nd year CS at NIT Warangal. Usually busy with classes but always reply to family. I text short and casual in Hinglish, never formal.`}
                />
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-gray-400">Be specific — it makes AI sound genuinely like you</p>
                  <span className={`text-xs font-medium ${charCount < 20 ? 'text-red-400' : 'text-gray-400'}`}>
                    {charCount}/{charLimit}
                  </span>
                </div>
                {charCount > 0 && charCount < 20 && (
                  <p className="text-xs text-red-400 mt-1">
                    At least {20 - charCount} more character{20 - charCount !== 1 ? 's' : ''} needed
                  </p>
                )}
              </div>
            </div>

            {/* Section B — AI Preferences */}
            <div className="card p-6">
              <div className="mb-5">
                <h2 className="text-base font-bold text-gray-900">How should AI reply?</h2>
                <p className="text-xs text-gray-500 mt-0.5">You can change these anytime from Settings</p>
              </div>

              {/* Language */}
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-2">Reply Language</label>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setAiLanguage(opt.value)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${aiLanguage === opt.value
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
                        }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tone */}
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-2">Reply Tone</label>
                <div className="grid grid-cols-3 gap-2">
                  {TONE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setAiTone(opt.value)}
                      className={`p-3 rounded-lg border text-left transition-all ${aiTone === opt.value
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                    >
                      <p className={`text-sm font-semibold ${aiTone === opt.value ? 'text-primary-700' : 'text-gray-800'}`}>
                        {opt.label}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 leading-tight">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Length */}
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-2">Reply Length</label>
                <div className="grid grid-cols-3 gap-2">
                  {LENGTH_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setAiLength(opt.value)}
                      className={`p-3 rounded-lg border text-left transition-all ${aiLength === opt.value
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                    >
                      <p className={`text-sm font-semibold ${aiLength === opt.value ? 'text-primary-700' : 'text-gray-800'}`}>
                        {opt.label}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 leading-tight">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Preview */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Preview — AI reply to Mom saying "beta kha liya?"
                </p>
                <div className="space-y-2">
                  <div className="flex justify-start">
                    <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-2 max-w-xs shadow-sm">
                      <p className="text-xs text-gray-400 mb-0.5">Mom</p>
                      <p className="text-sm text-gray-700">beta kha liya? 🥺</p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="bg-primary-600 rounded-2xl rounded-tr-sm px-4 py-2 max-w-xs shadow-sm">
                      <p className="text-xs text-primary-200 mb-0.5">You (AI)</p>
                      <p className="text-sm text-white transition-all duration-200">
                        {getPreview(aiLanguage, aiTone, aiLength)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={!canSubmit}
              className="btn btn-primary w-full py-3 text-base font-semibold"
            >
              {loading
                ? <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </span>
                : 'Continue →'
              }
            </button>

            <p className="text-center text-xs text-gray-400 pb-4">
              You can add contacts and upload chat history from the dashboard
            </p>
          </div>
        )}


        {/* ── STEP 3: Activate Trial ── */}
        


      </div>
    </div>
  );
};

export default Onboarding;