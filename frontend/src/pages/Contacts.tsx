import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { contactService, personalityService } from '../services/apiService';
import { FamilyContact } from '../types';
import {
  Users, Plus, Trash2, ToggleLeft, ToggleRight,
  Upload, ArrowRight, ArrowLeft, BookOpen, Sparkles, Pencil,
  Zap, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';


const Contacts: React.FC = () => {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<FamilyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Add modal step state — UNCHANGED
  const [currentStep, setCurrentStep] = useState(1);
  const [newContact, setNewContact] = useState({ name: '', phone: '', relation: '' });
  const [knowledgeBase, setKnowledgeBase] = useState('');
  const [enhancing, setEnhancing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [studentName, setStudentName] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingStep, setProcessingStep] = useState(false);
  const [newContactId, setNewContactId] = useState<string | null>(null);

  // Edit modal state — NEW
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingContact, setEditingContact] = useState<FamilyContact | null>(null);
  const [editForm, setEditForm] = useState({ name: '', phone: '', relation: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  // KB editor state inside edit modal — NEW
  const [editTab, setEditTab] = useState<'info' | 'kb'>('info');
  const [editKB, setEditKB] = useState('');
  const [loadingKB, setLoadingKB] = useState(false);
  const [savingKB, setSavingKB] = useState(false);
  const [enhancingKB, setEnhancingKB] = useState(false);


  useEffect(() => {
    loadContacts();
  }, []);


  // UNCHANGED
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


  // UNCHANGED
  const resetModal = () => {
    setNewContact({ name: '', phone: '', relation: '' });
    setKnowledgeBase('');
    setEnhancing(false);
    setSelectedFile(null);
    setStudentName('');
    setUploadProgress(0);
    setCurrentStep(1);
    setNewContactId(null);
    setProcessingStep(false);
    setShowAddModal(false);
  };


  // NEW: open edit modal pre-filled with existing contact data
  const openEditModal = (contact: FamilyContact) => {
    setEditingContact(contact);
    setEditForm({ name: contact.name, phone: contact.phone, relation: contact.relation });
    setEditTab('info'); // always open on Contact Info tab
    setEditKB('');      // clear previous KB content
    setShowEditModal(true);
  };


  // NEW: close and reset edit modal
  const closeEditModal = () => {
    setEditingContact(null);
    setEditForm({ name: '', phone: '', relation: '' });
    setSavingEdit(false);
    setEditTab('info');
    setEditKB('');
    setLoadingKB(false);
    setSavingKB(false);
    setEnhancingKB(false);
    setShowEditModal(false);
  };


  // Load KB when switching to KB tab — NEW
  const handleEditTabSwitch = async (tab: 'info' | 'kb') => {
    setEditTab(tab);
    // Only fetch if switching to KB tab and not already loaded
    if (tab === 'kb' && editKB === '' && editingContact) {
      setLoadingKB(true);
      try {
        const response = await personalityService.getKnowledgeBase(user!._id, editingContact._id);
        setEditKB(response.data?.knowledgeBase || '');
      } catch {
        setEditKB(''); // no KB yet — empty textarea is fine
      } finally {
        setLoadingKB(false);
      }
    }
  };


  // Save KB from edit modal — NEW
  const handleKBSave = async () => {
    if (!editingContact) return;
    setSavingKB(true);
    try {
      await personalityService.saveKnowledgeBase(user!._id, editingContact._id, editKB.trim());
      toast.success('Knowledge base updated!');
      await loadContacts(); // refreshes AI Ready badge on card
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save knowledge base');
    } finally {
      setSavingKB(false);
    }
  };


  // Enhance KB text from edit modal — NEW
  const handleKBEnhance = async () => {
    if (!editKB.trim() || editKB.trim().length < 5) {
      toast.error('Write a few words first, then enhance');
      return;
    }
    setEnhancingKB(true);
    try {
      const response = await personalityService.enhanceContext(
        editKB.trim(),
        editingContact!.name,
        editingContact!.relation
      );
      setEditKB(response.data.enhanced);
      toast.success('✨ Enhanced! You can still edit before saving.');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to enhance. Try again.');
    } finally {
      setEnhancingKB(false);
    }
  };

  // NEW: submit edited contact
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContact) return;

    setSavingEdit(true);
    try {
      await contactService.update(
        editingContact._id,
        editForm.name.trim(),
        editForm.phone.trim(),
        editForm.relation.trim()
      );
      toast.success('Contact updated successfully');
      await loadContacts();
      closeEditModal();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update contact');
    } finally {
      setSavingEdit(false);
    }
  };


  // UNCHANGED
  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingStep(true);
    try {
      const response = await contactService.create(
        user!._id, newContact.name, newContact.phone, newContact.relation
      );
      setNewContactId(response.data._id);
      setCurrentStep(2);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to add contact');
    } finally {
      setProcessingStep(false);
    }
  };


  // UNCHANGED
  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!knowledgeBase.trim() || !newContactId) {
      toast.error('Please write something about this contact first');
      return;
    }
    setProcessingStep(true);
    try {
      await personalityService.saveKnowledgeBase(user!._id, newContactId, knowledgeBase.trim());
      toast.success('Context saved! Now optionally upload chat history for style learning.');
      setCurrentStep(3);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save knowledge base');
    } finally {
      setProcessingStep(false);
    }
  };


  // UNCHANGED
  const handleEnhance = async () => {
    if (!knowledgeBase.trim() || knowledgeBase.trim().length < 5) {
      toast.error('Write a few words first, then enhance');
      return;
    }
    setEnhancing(true);
    try {
      const response = await personalityService.enhanceContext(
        knowledgeBase.trim(), newContact.name, newContact.relation
      );
      setKnowledgeBase(response.data.enhanced);
      toast.success('✨ Enhanced! You can still edit it before saving.');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to enhance. Try again.');
    } finally {
      setEnhancing(false);
    }
  };


  // UNCHANGED
  const handleSkipKnowledgeBase = () => {
    toast("Skipped. AI replies will be generic without context.", { icon: 'ℹ️' });
    setCurrentStep(3);
  };


  // UNCHANGED
  const handleStep3Submit = async (e: React.FormEvent) => {
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
      await personalityService.uploadChat(user!._id, newContactId, studentName, selectedFile);
      clearInterval(progressInterval);
      setUploadProgress(100);
      toast.success(`✅ ${newContact.name} is fully set up! AI is ready to reply.`);
      await loadContacts();
      setTimeout(() => resetModal(), 800);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to upload chat');
    } finally {
      setProcessingStep(false);
    }
  };


  // UNCHANGED
  const handleSkipChatUpload = async () => {
    toast.success(`✅ ${newContact.name} added! AI will reply using the context you provided.`);
    await loadContacts();
    resetModal();
  };


  // UNCHANGED
  const handleToggle = async (contactId: string) => {
    try {
      await contactService.toggle(contactId);
      loadContacts();
      toast.success('Contact status updated');
    } catch (error: any) {
      toast.error('Failed to toggle contact');
    }
  };


  // UNCHANGED
  const handleDelete = async (contactId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      await contactService.delete(contactId);
      toast.success('Contact deleted');
      loadContacts();
    } catch (error: any) {
      toast.error('Failed to delete contact');
    }
  };


  // UNCHANGED
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }


  const STEPS = ['Contact Info', 'Knowledge Base', 'Chat Upload'];


  return (
    <div className="space-y-6">

      {/* Header — UNCHANGED */}
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


      {/* Contacts List — CHANGED: Edit button added to card footer */}
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

              <p className="text-sm text-gray-600 mb-2">{contact.phone}</p>
              <div className="mb-3">
                {(contact as any).aiStatus === 'ready' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                    <Zap className="w-3 h-3" />
                    AI Ready
                  </span>
                )}
                {(contact as any).aiStatus === 'partial' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">
                    <AlertCircle className="w-3 h-3" />
                    No Context
                  </span>
                )}
                {(contact as any).aiStatus === 'none' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-gray-100 text-gray-500 rounded-full">
                    <AlertCircle className="w-3 h-3" />
                    Not Set Up
                  </span>
                )}
              </div>

              {/* CHANGED: Pencil + Trash grouped on right */}
              <div className="flex items-center justify-between">
                <span className={`px-3 py-1 text-xs font-medium rounded-full ${contact.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                  {contact.isActive ? 'Active' : 'Inactive'}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(contact)}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(contact._id, contact.name)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
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


      {/* ── Edit Contact Modal — NEW ── */}
      {/* Edit Contact Modal — UPDATED with 2 tabs */}
      {showEditModal && editingContact && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">

            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-primary-600" />
                <h2 className="text-xl font-bold text-gray-900">Edit Contact</h2>
              </div>
              <button
                onClick={closeEditModal}
                className="text-gray-400 hover:text-gray-600"
                disabled={savingEdit || savingKB || enhancingKB}
              >
                ✕
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-5">
              <button
                type="button"
                onClick={() => handleEditTabSwitch('info')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${editTab === 'info'
                    ? 'text-primary-600 border-b-2 border-primary-600'
                    : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                Contact Info
              </button>
              <button
                type="button"
                onClick={() => handleEditTabSwitch('kb')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${editTab === 'kb'
                    ? 'text-primary-600 border-b-2 border-primary-600'
                    : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                Knowledge Base
              </button>
            </div>

            {/* Tab: Contact Info */}
            {editTab === 'info' && (
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="input"
                    placeholder="e.g., Mom"
                    required
                    disabled={savingEdit}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="input"
                    placeholder="+919876543210"
                    required
                    disabled={savingEdit}
                  />
                  <p className="text-xs text-gray-500 mt-1">Include country code (e.g., +91 for India)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Relation</label>
                  <input
                    type="text"
                    value={editForm.relation}
                    onChange={(e) => setEditForm({ ...editForm, relation: e.target.value })}
                    className="input"
                    placeholder="e.g., Mother, Girlfriend, Best Friend"
                    required
                    disabled={savingEdit}
                  />
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="btn btn-secondary flex-1"
                    disabled={savingEdit}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary flex-1"
                    disabled={savingEdit}
                  >
                    {savingEdit ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}

            {/* Tab: Knowledge Base */}
            {editTab === 'kb' && (
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-blue-800">
                    <strong>Write anything about {editingContact.name}</strong> — personality,
                    how they talk, topics you discuss, your relationship. AI uses this to reply like you.
                  </p>
                </div>

                {loadingKB ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                  </div>
                ) : (
                  <>
                    <textarea
                      value={editKB}
                      onChange={(e) => setEditKB(e.target.value)}
                      className="input resize-none w-full"
                      rows={7}
                      placeholder={`E.g. "she's my gf, lives in hyd, works at tcs, always asks if I ate, I call her baby, we talk hinglish"`}
                      disabled={savingKB || enhancingKB}
                    />

                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={handleKBEnhance}
                        disabled={enhancingKB || savingKB || !editKB.trim()}
                        className="flex items-center gap-1.5 text-sm font-medium text-purple-600 hover:text-purple-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {enhancingKB ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                            Enhancing...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            ✨ Enhance with AI
                          </>
                        )}
                      </button>
                      <span className="text-xs text-gray-400">{editKB.length} characters</span>
                    </div>

                    <div className="flex gap-3 mt-2">
                      <button
                        type="button"
                        onClick={closeEditModal}
                        className="btn btn-secondary flex-1"
                        disabled={savingKB || enhancingKB}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleKBSave}
                        disabled={savingKB || enhancingKB || !editKB.trim()}
                        className="btn btn-primary flex-1"
                      >
                        {savingKB ? 'Saving...' : 'Save Knowledge Base'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

          </div>
        </div>
      )}
      {/* ── end Edit Contact Modal ── */}


      {/* Add Contact Modal — UNCHANGED */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6">

            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-1">
                {STEPS.map((label, idx) => {
                  const stepNum = idx + 1;
                  const done = stepNum < currentStep;
                  const active = stepNum === currentStep;
                  return (
                    <React.Fragment key={stepNum}>
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${done || active ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'
                          }`}>
                          {stepNum}
                        </div>
                        <span className="text-xs text-gray-500 mt-1 hidden sm:block whitespace-nowrap">
                          {label}
                        </span>
                      </div>
                      {idx < STEPS.length - 1 && (
                        <div className={`w-8 h-1 mb-4 mx-1 ${done ? 'bg-primary-600' : 'bg-gray-200'}`} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
              <button
                onClick={resetModal}
                className="text-gray-400 hover:text-gray-600 mb-4"
                disabled={processingStep || enhancing}
              >
                ✕
              </button>
            </div>


            {/* Step 1 — UNCHANGED */}
            {currentStep === 1 && (
              <>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Add New Contact</h2>
                <p className="text-gray-600 mb-6">Enter your family member's details</p>

                <form onSubmit={handleStep1Submit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                    <input
                      type="tel"
                      value={newContact.phone}
                      onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                      className="input"
                      placeholder="+919876543210"
                      required
                      disabled={processingStep}
                    />
                    <p className="text-xs text-gray-500 mt-1">Include country code (e.g., +91 for India)</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Relation</label>
                    <input
                      type="text"
                      value={newContact.relation}
                      onChange={(e) => setNewContact({ ...newContact, relation: e.target.value })}
                      className="input"
                      placeholder="e.g., Mother, Girlfriend, Best Friend"
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
                      {processingStep ? 'Creating...' : (<>Next <ArrowRight className="w-4 h-4 ml-2" /></>)}
                    </button>
                  </div>
                </form>
              </>
            )}


            {/* Step 2 — UNCHANGED */}
            {currentStep === 2 && (
              <>
                <div className="flex items-center gap-3 mb-2">
                  <BookOpen className="w-8 h-8 text-primary-600 flex-shrink-0" />
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      Tell AI about {newContact.name}
                    </h2>
                    <p className="text-sm text-gray-500">Most important step for quality replies</p>
                  </div>
                </div>

                <div className="mt-3 mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-blue-800">
                    <strong>Write anything helpful</strong> — who they are, your relationship,
                    what you call each other, topics you discuss, things to avoid, your situation, anything.
                  </p>
                </div>

                <form onSubmit={handleStep2Submit}>
                  <textarea
                    value={knowledgeBase}
                    onChange={(e) => setKnowledgeBase(e.target.value)}
                    className="input resize-none w-full"
                    rows={7}
                    placeholder={`E.g. "she's my gf, lives in hyd, works at tcs, always asks if I ate, I call her baby, we talk hinglish"`}
                    disabled={processingStep || enhancing}
                  />

                  <div className="flex items-center justify-between mt-2 mb-1">
                    <button
                      type="button"
                      onClick={handleEnhance}
                      disabled={enhancing || processingStep || !knowledgeBase.trim()}
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
                          ✨ Enhance with AI
                        </>
                      )}
                    </button>
                    <span className="text-xs text-gray-400">{knowledgeBase.length} characters</span>
                  </div>

                  <div className="flex gap-3 mt-4">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="btn btn-secondary flex-1 flex items-center justify-center"
                      disabled={processingStep || enhancing}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={processingStep || enhancing || !knowledgeBase.trim()}
                      className="btn btn-primary flex-1 flex items-center justify-center"
                    >
                      {processingStep ? 'Saving...' : (<>Save & Continue <ArrowRight className="w-4 h-4 ml-2" /></>)}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleSkipKnowledgeBase}
                    className="w-full text-sm text-gray-500 hover:text-gray-800 underline mt-3"
                    disabled={processingStep || enhancing}
                  >
                    Skip (AI replies will be very generic without context)
                  </button>
                </form>
              </>
            )}


            {/* Step 3 — UNCHANGED */}
            {currentStep === 3 && (
              <>
                <div className="text-center mb-4">
                  <Upload className="w-10 h-10 text-primary-600 mx-auto mb-3" />
                  <h2 className="text-xl font-bold text-gray-900 mb-1">Upload Chat History</h2>
                  <p className="text-gray-500 text-sm">
                    Optional — helps AI learn <strong>your texting style</strong> with {newContact.name}
                  </p>
                </div>

                <div className="p-3 bg-green-50 border border-green-200 rounded-lg mb-4">
                  <p className="text-xs text-green-800">
                    ✅ Context already saved! AI can already reply.
                    Chat upload just makes the style more natural.
                  </p>
                </div>

                <form onSubmit={handleStep3Submit} className="space-y-4">
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
                      onClick={() => setCurrentStep(2)}
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
                      {processingStep ? 'Uploading...' : 'Upload & Train Style'}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleSkipChatUpload}
                    className="w-full text-sm text-gray-500 hover:text-gray-800 underline mt-2"
                    disabled={processingStep}
                  >
                    Skip — finish with just the context
                  </button>
                </form>

                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
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