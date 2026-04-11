import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { conversationService } from '../services/apiService';
import { Conversation, Message } from '../types';
import { MessageCircle, Send, ArrowLeft, Mic, Zap } from 'lucide-react';
import toast from 'react-hot-toast';


const Conversations: React.FC = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);


// eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadConversations();
  }, []);


// eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (selectedContact) {
      loadMessages(selectedContact._id);
    }
  }, [selectedContact]);


  // NEW: Poll messages every 8 seconds while a contact is open
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!selectedContact) return;
    const interval = setInterval(() => {
      loadMessages(selectedContact._id);
    }, 8000);
    return () => clearInterval(interval);
  }, [selectedContact]);


  // NEW: Refresh conversation list every 15 seconds (unread counts, last message)
  useEffect(() => {
    const interval = setInterval(() => {
      loadConversations();
    }, 15000);
    return () => clearInterval(interval);
  }, []);


  const loadConversations = async () => {
    try {
      const response = await conversationService.getAll(user!._id);
      setConversations(response.data);
    } catch (error: any) {
      toast.error('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };


  const loadMessages = async (contactId: string) => {
    try {
      const response = await conversationService.getMessages(user!._id, contactId);
      setMessages(response.data.messages);
    } catch (error: any) {
      toast.error('Failed to load messages');
    }
  };


  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedContact) return;

    setSending(true);
    try {
      await conversationService.sendMessage(user!._id, selectedContact._id, newMessage);
      setNewMessage('');
      toast.success('Message sent!');
      loadMessages(selectedContact._id);
    } catch (error: any) {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
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
      <h1 className="text-3xl font-bold text-gray-900">Conversations</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-250px)]">

        {/* Contacts List */}
        <div className="lg:col-span-1 card overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Contacts</h3>
          </div>
          <div className="overflow-y-auto h-full">
            {conversations.length > 0 ? (
              conversations.map((conv: any) => (
                <button
                  key={conv.contact._id}
                  onClick={() => setSelectedContact(conv.contact)}
                  className={`w-full p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left ${
                    selectedContact?._id === conv.contact._id ? 'bg-primary-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-gray-900">{conv.contact.name}</p>
                    {conv.unreadCount > 0 && (
                      <span className="px-2 py-1 text-xs font-medium text-white bg-primary-600 rounded-full">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 truncate">
                    {conv.lastMessage?.finalText || conv.lastMessage?.originalContent || 'No messages yet'}
                  </p>
                  {conv.lastMessage && (
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(conv.lastMessage.timestamp).toLocaleString()}
                    </p>
                  )}
                </button>
              ))
            ) : (
              <div className="p-8 text-center">
                <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">No conversations yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Messages Area */}
        <div className="lg:col-span-2 card flex flex-col overflow-hidden">
          {selectedContact ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-gray-200 flex items-center">
                <button
                  onClick={() => setSelectedContact(null)}
                  className="lg:hidden mr-3 p-2 hover:bg-gray-100 rounded-lg"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h3 className="font-semibold text-gray-900">{selectedContact.name}</h3>
                  <p className="text-sm text-gray-600">{selectedContact.relation}</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg: any) => (
                  <div
                    key={msg._id}
                    className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      msg.direction === 'outgoing'
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-200 text-gray-900'
                    }`}>
                      {msg.type === 'voice_note' && msg.transcribedText && (
                        <div className="flex items-center mb-1 text-xs opacity-75">
                          <Mic className="w-3 h-3 mr-1" />
                          Voice note
                        </div>
                      )}
                      <p className="text-sm">{msg.finalText || msg.originalContent}</p>
                      <div className="flex items-center justify-between mt-1 text-xs opacity-75">
                        <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                        {msg.generatedByAI && (
                          <span className="flex items-center ml-2">
                            <Zap className="w-3 h-3 mr-1" />
                            AI
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Input */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="input flex-1"
                    disabled={sending}
                  />
                  <button
                    type="submit"
                    disabled={sending || !newMessage.trim()}
                    className="btn btn-primary"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageCircle className="w-16 h-16 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">Select a conversation to start messaging</p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};


export default Conversations;