import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { contactService, personalityService } from '../services/apiService';
import { FamilyContact } from '../types';
import { Users, Plus, Trash2, ToggleLeft, ToggleRight, Upload, ArrowRight, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

const Contacts: React.FC = () => {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<FamilyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Multi-step modal state
  const [currentStep, setCurrentStep] = useState(1); // 1 = Contact Details, 2 = Personality Upload
  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    relation: '',
  });

  // Personality upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [studentName, setStudentName] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingStep, setProcessingStep] = useState(false);

  // Track the newly created contact ID
  const [newContactId, setNewContactId] = useState<string | null>(null);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      const response = await contactService.getAll(user!._id);
      setContacts(response.data);
    } catch (error: any) {
      toast.error('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  const resetModal = () => {
    setNewContact({ name: '', phone: '', relation: '' });
    setSelectedFile(null);
    setStudentName('');
    setUploadProgress(0);
    setCurrentStep(1);
    setNewContactId(null);
    setProcessingStep(false);
    setShowAddModal(false);
  };

  // Step 1: Create the contact
  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingStep(true);

    try {
      const response = await contactService.create(
        user!._id,
        newContact.name,
        newContact.phone,
        newContact.relation
      );

      setNewContactId(response.data._id);
      toast.success('Contact added! Now upload chat history to train the AI.');
      setCurrentStep(2);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to add contact');
    } finally {
      setProcessingStep(false);
    }
  };

  // Step 2: Upload personality profile
  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile || !studentName || !newContactId) {
      toast.error('Please select a file and enter your name');
      return;
    }

    setProcessingStep(true);
    setUploadProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      await personalityService.uploadChat(
        user!._id,
        newContactId,
        studentName,
        selectedFile
      );

      clearInterval(progressInterval);
      setUploadProgress(100);

      toast.success(`✅ ${newContact.name} is ready! AI will now reply in your style.`);

      // Reload contacts and close modal
      await loadContacts();
      setTimeout(() => resetModal(), 1000);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to upload chat');
    } finally {
      setProcessingStep(false);
    }
  };

  // Skip personality upload (optional)
  const handleSkipPersonality = async () => {
    toast('Contact added without personality. AI won\'t reply until you upload chat history.', {
      icon: 'ℹ️',
    });
    await loadContacts();
    resetModal();
  };

  const handleToggle = async (contactId: string) => {
    try {
      await contactService.toggle(contactId);
      loadContacts();
      toast.success('Contact status updated');
    } catch (error: any) {
      toast.error('Failed to toggle contact');
    }
  };

  const handleDelete = async (contactId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete ${name}?`)) {
      return;
    }

    try {
      await contactService.delete(contactId);
      toast.success('Contact deleted');
      loadContacts();
    } catch (error: any) {
      toast.error('Failed to delete contact');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Family Contacts</h1>
          <p className="text-gray-600 mt-1">Manage who AI can reply to</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary flex items-center"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Contact
        </button>
      </div>

      {/* Contacts List */}
      {contacts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {contacts.map((contact) => (
            <div key={contact._id} className="card p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{contact.name}</h3>
                  <p className="text-sm text-gray-600">{contact.relation}</p>
                </div>
                <button
                  onClick={() => handleToggle(contact._id)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title={contact.isActive ? 'Deactivate' : 'Activate'}
                >
                  {contact.isActive ? (
                    <ToggleRight className="w-6 h-6 text-green-600" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-gray-400" />
                  )}
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-4">{contact.phone}</p>

              <div className="flex items-center justify-between">
                <span
                  className={`px-3 py-1 text-xs font-medium rounded-full ${contact.isActive
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                    }`}
                >
                  {contact.isActive ? 'Active' : 'Inactive'}
                </span>
                <button
                  onClick={() => handleDelete(contact._id, contact.name)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No contacts yet</h3>
          <p className="text-gray-600 mb-6">Add your first family contact to get started</p>
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
            <Plus className="w-5 h-5 mr-2" />
            Add Contact
          </button>
        </div>
      )}

      {/* Add Contact Modal - Multi-Step */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6">
            {/* Progress Indicator */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${currentStep >= 1 ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-600'
                    }`}
                >
                  1
                </div>
                <div className={`w-12 h-1 ${currentStep >= 2 ? 'bg-primary-600' : 'bg-gray-200'}`} />
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${currentStep >= 2 ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-600'
                    }`}
                >
                  2
                </div>
              </div>
              <button
                onClick={resetModal}
                className="text-gray-400 hover:text-gray-600"
                disabled={processingStep}
              >
                ✕
              </button>
            </div>

            {/* Step 1: Contact Details */}
            {currentStep === 1 && (
              <>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Add New Contact</h2>
                <p className="text-gray-600 mb-6">Enter your family member's details</p>

                <form onSubmit={handleStep1Submit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      value={newContact.name}
                      onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                      className="input"
                      placeholder="e.g., Mom"
                      required
                      disabled={processingStep}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={newContact.phone}
                      onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                      className="input"
                      placeholder="+919876543210"
                      required
                      disabled={processingStep}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Include country code (e.g., +91 for India)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Relation
                    </label>
                    <input
                      type="text"
                      value={newContact.relation}
                      onChange={(e) => setNewContact({ ...newContact, relation: e.target.value })}
                      className="input"
                      placeholder="e.g., Mother"
                      required
                      disabled={processingStep}
                    />
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      type="button"
                      onClick={resetModal}
                      className="btn btn-secondary flex-1"
                      disabled={processingStep}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary flex-1 flex items-center justify-center"
                      disabled={processingStep}
                    >
                      {processingStep ? (
                        'Creating...'
                      ) : (
                        <>
                          Next: Upload Chat
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* Step 2: Personality Upload */}
            {currentStep === 2 && (
              <>
                <Upload className="w-12 h-12 text-primary-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">
                  Train AI with Chat History
                </h2>
                <p className="text-gray-600 mb-6 text-center">
                  Upload your WhatsApp chat with {newContact.name} to teach AI your style
                </p>

                <form onSubmit={handleStep2Submit} className="space-y-4">
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
                      required
                      disabled={processingStep}
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
                      required
                      disabled={processingStep}
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

                  <div className="flex gap-3 mt-6">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="btn btn-secondary flex-1 flex items-center justify-center"
                      disabled={processingStep}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={processingStep || !selectedFile || !studentName}
                      className="btn btn-primary flex-1"
                    >
                      {processingStep ? 'Uploading...' : 'Upload & Train AI'}
                    </button>
                  </div>

                  {/* Skip Option */}
                  <button
                    type="button"
                    onClick={handleSkipPersonality}
                    className="w-full text-sm text-gray-600 hover:text-gray-900 underline mt-2"
                    disabled={processingStep}
                  >
                    Skip for now (AI won't reply until you upload)
                  </button>
                </form>

                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>How to export:</strong> Open WhatsApp → Chat with {newContact.name} → ⋮ → More → Export chat → Without Media
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Contacts;