import React, { useState } from 'react';
import { sessionService } from '../services/apiService';
import { QrCode, X, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';


interface WhatsAppQRModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onConnected: () => void; // called when scan succeeds
}


const WhatsAppQRModal: React.FC<WhatsAppQRModalProps> = ({
  userId,
  isOpen,
  onClose,
  onConnected,
}) => {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<'idle' | 'pending_qr' | 'connected'>('idle');
  const [loading, setLoading] = useState(false);


  if (!isOpen) return null;


  const handleCreateSession = async () => {
    setLoading(true);
    try {
      await sessionService.createSession(userId);
      toast.success('Session created! Scan QR code with WhatsApp');
      startPollingQR();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create session');
    } finally {
      setLoading(false);
    }
  };


  const startPollingQR = () => {
    const interval = setInterval(async () => {
      try {
        const response = await sessionService.getQR(userId);
        if (response.data.status === 'connected') {
          setSessionStatus('connected');
          clearInterval(interval);
          toast.success('WhatsApp connected successfully!');
          // wait 1.5s so user sees the success screen, then close
          setTimeout(() => {
            onConnected();
            handleClose();
          }, 1500);
        } else if (response.data.qrCode) {
          setQrCode(response.data.qrCode);
          setSessionStatus('pending_qr');
        }
      } catch {
        clearInterval(interval);
      }
    }, 3000);

    // Stop polling after 5 minutes
    setTimeout(() => clearInterval(interval), 5 * 60 * 1000);
  };


  const handleClose = () => {
    setQrCode(null);
    setSessionStatus('idle');
    setLoading(false);
    onClose();
  };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary-600" />
            <h2 className="text-xl font-bold text-gray-900">Reconnect WhatsApp</h2>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-center">

          {/* Success state */}
          {sessionStatus === 'connected' && (
            <div className="py-6">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-3" />
              <p className="text-lg font-semibold text-gray-900">Connected!</p>
              <p className="text-sm text-gray-600 mt-1">WhatsApp is now linked</p>
            </div>
          )}

          {/* QR code state */}
          {sessionStatus === 'pending_qr' && qrCode && (
            <>
              <img
                src={`data:image/png;base64,${qrCode}`}
                alt="WhatsApp QR Code"
                className="w-56 h-56 mx-auto border-4 border-gray-200 rounded-lg mb-4"
              />
              <p className="text-sm text-gray-600 mb-1">
                Open WhatsApp → Settings → Linked Devices → Link a Device
              </p>
              <p className="text-xs text-gray-400">QR refreshes automatically every 3s</p>
            </>
          )}

          {/* Idle state — initial */}
          {sessionStatus === 'idle' && (
            <>
              <QrCode className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-6 text-sm">
                Generate a QR code and scan it with WhatsApp to reconnect your account
              </p>
              <button
                onClick={handleCreateSession}
                disabled={loading}
                className="btn btn-primary"
              >
                {loading ? 'Generating...' : 'Generate QR Code'}
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  );
};


export default WhatsAppQRModal;