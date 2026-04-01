import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { contactService } from '../services/apiService';
import { FamilyContact } from '../types';
import { Users, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';

const Contacts: React.FC = () => {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<FamilyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    relation: '',
  });

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

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await contactService.create(
        user!._id,
        newContact.name,
        newContact.phone,
        newContact.relation
      );
      toast.success('Contact added successfully!');
      setNewContact({ name: '', phone: '', relation: '' });
      setShowAddModal(false);
      loadContacts();
    } catch (error: any) {
      toast.error('Failed to add contact');
    }
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
                  className={`px-3 py-1 text-xs font-medium rounded-full ${
                    contact.isActive
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

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Add New Contact</h2>

            <form onSubmit={handleAddContact} className="space-y-4">
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
                />
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
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary flex-1">
                  Add Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Contacts;