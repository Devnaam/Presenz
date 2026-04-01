import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { sessionService, contactService, personalityService, statusService } from '../services/apiService';
import { QrCode, Upload, Users, Settings } from 'lucide-react';

const Onboarding: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1: WhatsApp QR
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<'pending_qr' | 'connected' | 'disconnected'>('pending_qr');

  // Step 2: Chat Upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [studentName, setStudentName] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  // Step 3: Add Contacts
  const [contacts, setContacts] = useState<Array<{ name: string; phone: string; relation: string }>>([
    { name: '', phone: '', relation: '' },
  ]);
  const [savedContactId, setSavedContactId] = useState<string | null>(null);

  // Step 4: Status Settings
  const [autoAwayEnabled, setAutoAwayEnabled] = useState(true);
  const [autoAwayMinutes, setAutoAwayMinutes] = useState(30);

  // Step 1: Create WhatsApp Session
  const handleCreateSession = async () => {
    setLoading(true);
    try {
      await sessionService.createSession(user!._id);
      toast.success('Session created! Scan QR code with WhatsApp');
      startPollingQR();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create session');
    } finally {
      setLoading(false);
    }
  };

  // Poll for QR code
  const startPollingQR = () => {
    const interval = setInterval(async () => {
      try {
        const response = await sessionService.getQR(user!._id);
        
        if (response.data.status === 'connected') {
          setSessionStatus('connected');
          clearInterval(interval);
          toast.success('WhatsApp connected successfully!');
        } else if (response.data.qrCode) {
          setQrCode(response.data.qrCode);
          setSessionStatus('pending_qr');
        }
      } catch (error) {
        clearInterval(interval);
      }
    }, 3000);

    // Stop polling after 5 minutes
    setTimeout(() => clearInterval(interval), 5 * 60 * 1000);
  };

  // Step 2: Upload Chat File
  const handleFileUpload = async () => {
    if (!selectedFile || !studentName || !savedContactId) {
      toast.error('Please select a file and enter your name');
      return;
    }

    setLoading(true);
    setUploadProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      await personalityService.uploadChat(user!._id, savedContactId, studentName, selectedFile);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      toast.success('Chat history analyzed successfully!');
      
      setTimeout(() => setCurrentStep(4), 1000);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to upload chat');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Add Contacts
  const handleAddContact = () => {
    setContacts([...contacts, { name: '', phone: '', relation: '' }]);
  };

  const handleContactChange = (index: number, field: string, value: string) => {
    const newContacts = [...contacts];
    newContacts[index] = { ...newContacts[index], [field]: value };
    setContacts(newContacts);
  };

  const handleSaveContacts = async () => {
    const validContacts = contacts.filter((c) => c.name && c.phone && c.relation);
    
    if (validContacts.length === 0) {
      toast.error('Please add at least one contact');
      return;
    }

    setLoading(true);
    try {
      // Save first contact and store its ID for personality upload
      const firstContact = await contactService.create(
        user!._id,
        validContacts[0].name,
        validContacts[0].phone,
        validContacts[0].relation
      );
      
      setSavedContactId(firstContact.data._id);

      // Save remaining contacts
      for (let i = 1; i < validContacts.length; i++) {
        await contactService.create(
          user!._id,
          validContacts[i].name,
          validContacts[i].phone,
          validContacts[i].relation
        );
      }

      toast.success('Contacts saved successfully!');
      setCurrentStep(2);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save contacts');
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Complete Onboarding
  const handleComplete = async () => {
    setLoading(true);
    try {
      await statusService.updateSettings(user!._id, autoAwayEnabled, autoAwayMinutes);
      await statusService.setMode(user!._id, 'available');
      
      toast.success('Setup complete! Welcome to Presenz');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to complete setup');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={`flex items-center ${step < 4 ? 'flex-1' : ''}`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    step <= currentStep
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {step}
                </div>
                {step < 4 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      step < currentStep ? 'bg-primary-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-600">
            <span>WhatsApp</span>
            <span>Upload Chat</span>
            <span>Add Contacts</span>
            <span>Settings</span>
          </div>
        </div>

        {/* Step Content */}
        <div className="card p-8">
          {/* Step 1: WhatsApp Connection */}
          {currentStep === 1 && (
            <div className="text-center">
              <QrCode className="w-16 h-16 text-primary-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Connect WhatsApp</h2>
              <p className="text-gray-600 mb-6">
                Scan the QR code with your WhatsApp to link your account
              </p>

              {sessionStatus === 'pending_qr' && qrCode && (
                <div className="mb-6">
                  <img
                    src={`data:image/png;base64,${qrCode}`}
                    alt="QR Code"
                    className="w-64 h-64 mx-auto border-4 border-gray-200 rounded-lg"
                  />
                  <p className="text-sm text-gray-500 mt-4">
                    Open WhatsApp → Settings → Linked Devices → Link a Device
                  </p>
                </div>
              )}

              {sessionStatus === 'connected' && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-800 font-medium">✓ WhatsApp Connected!</p>
                  <button
                    onClick={() => setCurrentStep(3)}
                    className="btn btn-primary mt-4"
                  >
                    Continue
                  </button>
                </div>
              )}

              {!qrCode && sessionStatus !== 'connected' && (
                <button
                  onClick={handleCreateSession}
                  disabled={loading}
                  className="btn btn-primary"
                >
                  {loading ? 'Generating QR...' : 'Generate QR Code'}
                </button>
              )}
            </div>
          )}

          {/* Step 2: Upload Chat */}
          {currentStep === 2 && (
            <div>
              <Upload className="w-16 h-16 text-primary-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-center mb-2">Upload Chat History</h2>
              <p className="text-gray-600 text-center mb-6">
                Export your WhatsApp chat with a family member to train the AI
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Your Name (as it appears in chat)
                  </label>
                  <input
                    type="text"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className="input"
                    placeholder="e.g., Rahul"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Chat Export File (.txt)
                  </label>
                  <input
                    type="file"
                    accept=".txt"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="input"
                  />
                </div>

                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setCurrentStep(3)}
                    className="btn btn-secondary flex-1"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleFileUpload}
                    disabled={loading || !selectedFile || !studentName}
                    className="btn btn-primary flex-1"
                  >
                    {loading ? 'Uploading...' : 'Upload & Analyze'}
                  </button>
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>How to export:</strong> Open WhatsApp → Chat → ⋮ → More → Export chat → Without Media
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Add Contacts */}
          {currentStep === 3 && (
            <div>
              <Users className="w-16 h-16 text-primary-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-center mb-2">Add Family Contacts</h2>
              <p className="text-gray-600 text-center mb-6">
                Add the family members you want AI to reply to
              </p>

              <div className="space-y-4 mb-6">
                {contacts.map((contact, index) => (
                  <div key={index} className="p-4 border border-gray-200 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <input
                        type="text"
                        placeholder="Name (e.g., Mom)"
                        value={contact.name}
                        onChange={(e) => handleContactChange(index, 'name', e.target.value)}
                        className="input"
                      />
                      <input
                        type="tel"
                        placeholder="Phone (+919876543210)"
                        value={contact.phone}
                        onChange={(e) => handleContactChange(index, 'phone', e.target.value)}
                        className="input"
                      />
                      <input
                        type="text"
                        placeholder="Relation (e.g., Mother)"
                        value={contact.relation}
                        onChange={(e) => handleContactChange(index, 'relation', e.target.value)}
                        className="input"
                      />
                    </div>
                  </div>
                ))}

                <button
                  onClick={handleAddContact}
                  className="btn btn-secondary w-full"
                >
                  + Add Another Contact
                </button>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="btn btn-secondary flex-1"
                >
                  Back
                </button>
                <button
                  onClick={handleSaveContacts}
                  disabled={loading}
                  className="btn btn-primary flex-1"
                >
                  {loading ? 'Saving...' : 'Save & Continue'}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Settings */}
          {currentStep === 4 && (
            <div>
              <Settings className="w-16 h-16 text-primary-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-center mb-2">Configure Settings</h2>
              <p className="text-gray-600 text-center mb-6">
                Set up auto-away detection
              </p>

              <div className="space-y-4 mb-6">
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <p className="font-medium">Auto-Away Mode</p>
                    <p className="text-sm text-gray-600">
                      Automatically switch to away after inactivity
                    </p>
                  </div>
                  <button
                    onClick={() => setAutoAwayEnabled(!autoAwayEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      autoAwayEnabled ? 'bg-primary-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        autoAwayEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {autoAwayEnabled && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Auto-away after (minutes)
                    </label>
                    <input
                      type="number"
                      min="5"
                      max="120"
                      value={autoAwayMinutes}
                      onChange={(e) => setAutoAwayMinutes(Number(e.target.value))}
                      className="input"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="btn btn-secondary flex-1"
                >
                  Back
                </button>
                <button
                  onClick={handleComplete}
                  disabled={loading}
                  className="btn btn-primary flex-1"
                >
                  {loading ? 'Completing...' : 'Complete Setup'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;