import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { profileService, authService, personalityService } from '../services/apiService'; 
import {
    User, Brain, Settings2, Save, Loader2,
    Info, MessageSquare, Languages, Lock, Eye, EyeOff,
    Sparkles 
} from 'lucide-react';
import toast from 'react-hot-toast';



type Tab = 'basic' | 'about' | 'ai' | 'password';


interface BasicForm {
    name: string;
    email: string;
    phone: string;
}


interface AIForm {
    aboutMe: string;
    aiLanguage: string;
    aiTone: string;
    aiLength: string;
}



const Profile: React.FC = () => {
    const { user, updateUser } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>('basic');
    const [loading, setLoading] = useState(true);
    const [savingBasic, setSavingBasic] = useState(false);
    const [savingAI, setSavingAI] = useState(false);
    const [enhancing, setEnhancing] = useState(false); {/* ✅ added */}


    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [savingPassword, setSavingPassword] = useState(false);
    const [showPasswords, setShowPasswords] = useState(false);


    const [basicForm, setBasicForm] = useState<BasicForm>({
        name: '',
        email: '',
        phone: '',
    });


    const [aiForm, setAIForm] = useState<AIForm>({
        aboutMe: '',
        aiLanguage: 'auto',
        aiTone: 'friendly',
        aiLength: 'match',
    });



    useEffect(() => {
        loadProfile();
    }, []);



    const loadProfile = async () => {
        try {
            const response = await profileService.getProfile(user!._id);
            const { user: userData, profile } = response.data.data;


            setBasicForm({
                name: userData.name || '',
                email: userData.email || '',
                phone: userData.phone || '',
            });


            setAIForm({
                aboutMe: profile.aboutMe || '',
                aiLanguage: profile.aiLanguage || 'auto',
                aiTone: profile.aiTone || 'friendly',
                aiLength: profile.aiLength || 'match',
            });
        } catch (error: any) {
            toast.error('Failed to load profile');
        } finally {
            setLoading(false);
        }
    };



    const handleSaveBasic = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingBasic(true);
        try {
            const response = await profileService.updateBasic(user!._id, basicForm);
            updateUser(response.data.data);
            toast.success('Basic info updated!');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to update basic info');
        } finally {
            setSavingBasic(false);
        }
    };



    const handleSaveAI = async () => {
        setSavingAI(true);
        try {
            await profileService.updateProfile(user!._id, aiForm);
            toast.success('Profile saved! AI will use this in future replies.');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to save profile');
        } finally {
            setSavingAI(false);
        }
    };


    {/* ✅ added — same pattern as Contacts.tsx */}
    const handleEnhanceAboutMe = async () => {
        if (!aiForm.aboutMe.trim() || aiForm.aboutMe.trim().length < 10) {
            toast.error('Write at least a sentence first, then enhance');
            return;
        }
        setEnhancing(true);
        try {
            const response = await personalityService.enhanceContext(
                aiForm.aboutMe.trim(),
                user!.name,
                'self'
            );
            setAIForm({ ...aiForm, aboutMe: response.data.enhanced });
            toast.success('Enhanced! Review and save when ready.');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to enhance. Try again.');
        } finally {
            setEnhancing(false);
        }
    };


    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();


        if (passwordForm.newPassword.length < 6) {
            toast.error('New password must be at least 6 characters');
            return;
        }


        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            toast.error('New passwords do not match');
            return;
        }


        setSavingPassword(true);
        try {
            await authService.changePassword(
                user!._id,
                passwordForm.currentPassword,
                passwordForm.newPassword
            );
            toast.success('Password changed successfully!');
            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to change password');
        } finally {
            setSavingPassword(false);
        }
    };



    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
            </div>
        );
    }



    const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
        { key: 'basic', label: 'Basic Info', icon: <User className="w-4 h-4" /> },
        { key: 'about', label: 'About Me', icon: <Brain className="w-4 h-4" /> },
        { key: 'ai', label: 'AI Preferences', icon: <Settings2 className="w-4 h-4" /> },
        { key: 'password', label: 'Password', icon: <Lock className="w-4 h-4" /> },
    ];



    return (
        <div className="space-y-6 max-w-2xl">


            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Your Profile</h1>
                <p className="text-gray-600 mt-1">
                    The more you fill in, the better AI sounds like you
                </p>
            </div>


            {/* Tabs */}
            <div className="card p-0 overflow-hidden">
                <div className="flex border-b border-gray-200">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-colors ${activeTab === tab.key
                                    ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>


                <div className="p-6">


                    {/* Tab: Basic Info — UNCHANGED */}
                    {activeTab === 'basic' && (
                        <form onSubmit={handleSaveBasic} className="space-y-4">
                            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-2">
                                <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                                <p className="text-xs text-blue-800">
                                    Changes here update your account across the entire app immediately.
                                </p>
                            </div>


                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Full Name
                                </label>
                                <input
                                    type="text"
                                    value={basicForm.name}
                                    onChange={(e) => setBasicForm({ ...basicForm, name: e.target.value })}
                                    className="input"
                                    placeholder="Your full name"
                                    required
                                    disabled={savingBasic}
                                />
                            </div>


                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    value={basicForm.email}
                                    onChange={(e) => setBasicForm({ ...basicForm, email: e.target.value })}
                                    className="input"
                                    placeholder="you@example.com"
                                    required
                                    disabled={savingBasic}
                                />
                            </div>


                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Phone Number
                                </label>
                                <input
                                    type="tel"
                                    value={basicForm.phone}
                                    onChange={(e) => setBasicForm({ ...basicForm, phone: e.target.value })}
                                    className="input"
                                    placeholder="+919876543210"
                                    required
                                    disabled={savingBasic}
                                />
                                <p className="text-xs text-gray-500 mt-1">Include country code (e.g. +91)</p>
                            </div>


                            <button
                                type="submit"
                                disabled={savingBasic}
                                className="btn btn-primary flex items-center gap-2 mt-2"
                            >
                                {savingBasic
                                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                                    : <><Save className="w-4 h-4" /> Save Basic Info</>
                                }
                            </button>
                        </form>
                    )}


                    {/* ✅ Tab: About Me — ONLY CHANGE: added Enhance button below textarea */}
                    {activeTab === 'about' && (
                        <div className="space-y-4">
                            <div className="p-3 bg-purple-50 border border-purple-100 rounded-lg flex items-start gap-2">
                                <Brain className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                                <p className="text-xs text-purple-800">
                                    <strong>This is how AI knows who it's replying as.</strong> Write anything
                                    about yourself — your life, personality, habits, interests, how you talk.
                                    The more detail you give, the more natural the replies sound.
                                </p>
                            </div>


                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    About You
                                </label>
                                <textarea
                                    value={aiForm.aboutMe}
                                    onChange={(e) => setAIForm({ ...aiForm, aboutMe: e.target.value })}
                                    className="input resize-none w-full"
                                    rows={10}
                                    placeholder={`Write anything that helps AI sound like you. For example:\n\n"I'm a 22yr old engineering student from Kadapa, AP. I'm usually busy with college and side projects. I talk in Hinglish with family. I'm close to my mom and sister. I always say 'haan haan' instead of yes. I'm working on a startup called Presenz. I don't like long replies — I keep it short and casual."`}
                                    disabled={savingAI || enhancing}
                                    maxLength={2000}
                                />

                                {/* ✅ ONLY ADDITION — Enhance button + char count row */}
                                <div className="flex items-center justify-between mt-2">
                                    <button
                                        type="button"
                                        onClick={handleEnhanceAboutMe}
                                        disabled={enhancing || savingAI || aiForm.aboutMe.trim().length < 10}
                                        className="flex items-center gap-1.5 text-sm font-medium text-purple-600 hover:text-purple-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {enhancing ? (
                                            <>
                                                <div className="w-3.5 h-3.5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                                                Enhancing...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-3.5 h-3.5" />
                                                Enhance with AI
                                            </>
                                        )}
                                    </button>
                                    <p className={`text-xs ${aiForm.aboutMe.length > 1800 ? 'text-red-500' : 'text-gray-400'}`}>
                                        {aiForm.aboutMe.length}/2000
                                    </p>
                                </div>
                                {/* ✅ END ADDITION */}

                            </div>


                            <button
                                type="button"
                                onClick={handleSaveAI}
                                disabled={savingAI || enhancing || !aiForm.aboutMe.trim()} 
                                className="btn btn-primary flex items-center gap-2"
                            >
                                {savingAI
                                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                                    : <><Save className="w-4 h-4" /> Save About Me</>
                                }
                            </button>
                        </div>
                    )}


                    {/* Tab: AI Preferences — UNCHANGED */}
                    {activeTab === 'ai' && (
                        <div className="space-y-6">
                            <div className="p-3 bg-green-50 border border-green-100 rounded-lg flex items-start gap-2">
                                <Settings2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <p className="text-xs text-green-800">
                                    These are global defaults for all AI replies.
                                    They can be overridden per-contact via the Knowledge Base.
                                </p>
                            </div>


                            {/* Language */}
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <Languages className="w-4 h-4 text-gray-500" />
                                    <label className="text-sm font-medium text-gray-700">Reply Language</label>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {[
                                        { value: 'auto', label: '🔄 Auto Detect' },
                                        { value: 'english', label: '🇬🇧 English' },
                                        { value: 'hindi', label: '🇮🇳 Hindi' },
                                        { value: 'hinglish', label: '🤝 Hinglish' },
                                        { value: 'tamil', label: '🌟 Tamil' },
                                    ].map((opt) => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => setAIForm({ ...aiForm, aiLanguage: opt.value })}
                                            className={`py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${aiForm.aiLanguage === opt.value
                                                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                                                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                                                }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>


                            {/* Tone */}
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <MessageSquare className="w-4 h-4 text-gray-500" />
                                    <label className="text-sm font-medium text-gray-700">Reply Tone</label>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { value: 'casual', label: '😎 Casual', desc: 'Relaxed, informal' },
                                        { value: 'friendly', label: '😊 Friendly', desc: 'Warm, natural' },
                                        { value: 'professional', label: '💼 Professional', desc: 'Formal, polite' },
                                    ].map((opt) => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => setAIForm({ ...aiForm, aiTone: opt.value })}
                                            className={`py-3 px-3 rounded-lg border text-left transition-colors ${aiForm.aiTone === opt.value
                                                    ? 'border-primary-500 bg-primary-50'
                                                    : 'border-gray-200 bg-white hover:border-gray-300'
                                                }`}
                                        >
                                            <p className={`text-sm font-medium ${aiForm.aiTone === opt.value ? 'text-primary-700' : 'text-gray-700'}`}>{opt.label}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>


                            {/* Reply Length */}
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <MessageSquare className="w-4 h-4 text-gray-500" />
                                    <label className="text-sm font-medium text-gray-700">Reply Length</label>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { value: 'short', label: '⚡ Short', desc: '1–2 sentences' },
                                        { value: 'medium', label: '📝 Medium', desc: '3–4 sentences' },
                                        { value: 'match', label: '🎯 Match', desc: 'Match their style' },
                                    ].map((opt) => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => setAIForm({ ...aiForm, aiLength: opt.value })}
                                            className={`py-3 px-3 rounded-lg border text-left transition-colors ${aiForm.aiLength === opt.value
                                                    ? 'border-primary-500 bg-primary-50'
                                                    : 'border-gray-200 bg-white hover:border-gray-300'
                                                }`}
                                        >
                                            <p className={`text-sm font-medium ${aiForm.aiLength === opt.value ? 'text-primary-700' : 'text-gray-700'}`}>{opt.label}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>


                            <button
                                type="button"
                                onClick={handleSaveAI}
                                disabled={savingAI}
                                className="btn btn-primary flex items-center gap-2"
                            >
                                {savingAI
                                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                                    : <><Save className="w-4 h-4" /> Save AI Preferences</>
                                }
                            </button>
                        </div>
                    )}


                    {/* Tab: Password — UNCHANGED */}
                    {activeTab === 'password' && (
                        <form onSubmit={handleChangePassword} className="space-y-4">
                            <div className="p-3 bg-yellow-50 border border-yellow-100 rounded-lg flex items-start gap-2">
                                <Lock className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                                <p className="text-xs text-yellow-800">
                                    Choose a strong password with at least 6 characters.
                                    You'll be logged out on other devices after changing.
                                </p>
                            </div>


                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => setShowPasswords(!showPasswords)}
                                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                                >
                                    {showPasswords
                                        ? <><EyeOff className="w-3.5 h-3.5" /> Hide passwords</>
                                        : <><Eye className="w-3.5 h-3.5" /> Show passwords</>
                                    }
                                </button>
                            </div>


                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                                <input
                                    type={showPasswords ? 'text' : 'password'}
                                    value={passwordForm.currentPassword}
                                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                                    className="input"
                                    placeholder="Enter current password"
                                    required
                                    disabled={savingPassword}
                                    autoComplete="current-password"
                                />
                            </div>


                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                                <input
                                    type={showPasswords ? 'text' : 'password'}
                                    value={passwordForm.newPassword}
                                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                    className="input"
                                    placeholder="Min. 6 characters"
                                    required
                                    disabled={savingPassword}
                                    autoComplete="new-password"
                                />
                                {passwordForm.newPassword.length > 0 && (
                                    <div className="mt-2">
                                        <div className="flex gap-1 mb-1">
                                            {[1, 2, 3, 4].map((level) => (
                                                <div
                                                    key={level}
                                                    className={`h-1 flex-1 rounded-full transition-colors ${passwordForm.newPassword.length >= level * 3
                                                            ? level <= 1 ? 'bg-red-400'
                                                                : level <= 2 ? 'bg-yellow-400'
                                                                    : level <= 3 ? 'bg-blue-400'
                                                                        : 'bg-green-500'
                                                            : 'bg-gray-200'
                                                        }`}
                                                />
                                            ))}
                                        </div>
                                        <p className="text-xs text-gray-500">
                                            {passwordForm.newPassword.length < 4 ? '🔴 Too short'
                                                : passwordForm.newPassword.length < 7 ? '🟡 Weak'
                                                    : passwordForm.newPassword.length < 10 ? '🔵 Good'
                                                        : '🟢 Strong'}
                                        </p>
                                    </div>
                                )}
                            </div>


                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                                <input
                                    type={showPasswords ? 'text' : 'password'}
                                    value={passwordForm.confirmPassword}
                                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                    className="input"
                                    placeholder="Repeat new password"
                                    required
                                    disabled={savingPassword}
                                    autoComplete="new-password"
                                />
                                {passwordForm.confirmPassword.length > 0 && (
                                    <p className={`text-xs mt-1 ${passwordForm.newPassword === passwordForm.confirmPassword ? 'text-green-600' : 'text-red-500'}`}>
                                        {passwordForm.newPassword === passwordForm.confirmPassword
                                            ? '✓ Passwords match' : '✗ Passwords do not match'}
                                    </p>
                                )}
                            </div>


                            <button
                                type="submit"
                                disabled={
                                    savingPassword ||
                                    !passwordForm.currentPassword ||
                                    !passwordForm.newPassword ||
                                    !passwordForm.confirmPassword ||
                                    passwordForm.newPassword !== passwordForm.confirmPassword
                                }
                                className="btn btn-primary flex items-center gap-2 mt-2"
                            >
                                {savingPassword
                                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Changing...</>
                                    : <><Lock className="w-4 h-4" /> Change Password</>
                                }
                            </button>
                        </form>
                    )}


                </div>
            </div>


        </div>
    );
};



export default Profile;