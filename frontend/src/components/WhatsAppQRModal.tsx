import React, { useState, useRef } from 'react';
import { sessionService } from '../services/apiService';
import { QrCode, X, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface WhatsAppQRModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onConnected: () => void;
}

type ModalState = 'idle' | 'loading' | 'pending_qr' | 'connected' | 'failed';

const WhatsAppQRModal: React.FC<WhatsAppQRModalProps> = ({
  userId,
  isOpen,
  onClose,
  onConnected,
}) => {
  const [qrCode, setQrCode]           = useState<string | null>(null);
  const [modalState, setModalState]   = useState<ModalState>('idle');
  const [failReason, setFailReason]   = useState<string>('');
  const intervalRef                   = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef                    = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!isOpen) return null;

  const stopPolling = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (timeoutRef.current)  { clearTimeout(timeoutRef.current);   timeoutRef.current = null;  }
  };

  const startPollingQR = () => {
    stopPolling();

    intervalRef.current = setInterval(async () => {
      try {
        const response = await sessionService.getQR(userId);
        const { status, qrCode: newQR } = response.data;

        if (status === 'connected') {
          stopPolling();
          setModalState('connected');
          setTimeout(() => {
            onConnected();
            handleClose();
          }, 1500);

        } else if (newQR) {
          setQrCode(newQR);
          setModalState('pending_qr');

        } else if (status === 'disconnected') {
          // ── Session died (401 / logged out) ──────────────────
          // Socket sets status DISCONNECTED when WA rejects creds.
          // Stop polling and show retry.
          stopPolling();
          setQrCode(null);
          setFailReason('QR expired or connection was rejected by WhatsApp. Please try again.');
          setModalState('failed');
        }

      } catch {
        stopPolling();
        setFailReason('Lost connection to server. Please try again.');
        setModalState('failed');
      }
    }, 3000);

    // Hard 5-minute timeout
    timeoutRef.current = setTimeout(() => {
      stopPolling();
      if (modalState !== 'connected') {
        setQrCode(null);
        setFailReason('QR code expired after 5 minutes. Please try again.');
        setModalState('failed');
      }
    }, 5 * 60 * 1000);
  };

  const handleCreateSession = async () => {
    setModalState('loading');
    setQrCode(null);
    setFailReason('');
    try {
      await sessionService.createSession(userId);
      startPollingQR();
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to create session';
      toast.error(msg);
      setFailReason(msg);
      setModalState('failed');
    }
  };

  const handleClose = () => {
    stopPolling();
    setQrCode(null);
    setModalState('idle');
    setFailReason('');
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

          {/* ── Connected ────────────────────────────────── */}
          {modalState === 'connected' && (
            <div className="py-6">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-3" />
              <p className="text-lg font-semibold text-gray-900">Connected!</p>
              <p className="text-sm text-gray-600 mt-1">WhatsApp is now linked</p>
            </div>
          )}

          {/* ── QR Showing ───────────────────────────────── */}
          {modalState === 'pending_qr' && qrCode && (
            <>
              <img
                src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                alt="WhatsApp QR Code"
                className="w-56 h-56 mx-auto border-4 border-gray-200 rounded-lg mb-4"
              />
              <p className="text-sm text-gray-600 mb-1">
                Open WhatsApp → Settings → Linked Devices → Link a Device
              </p>
              <p className="text-xs text-gray-400">QR refreshes automatically every 3s</p>
            </>
          )}

          {/* ── Generating (loading) ─────────────────────── */}
          {modalState === 'loading' && (
            <div className="py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4" />
              <p className="text-gray-600 text-sm">Generating QR code...</p>
            </div>
          )}

          {/* ── Waiting for QR (created but no QR yet) ───── */}
          {modalState === 'pending_qr' && !qrCode && (
            <div className="py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4" />
              <p className="text-gray-600 text-sm">Waiting for QR code...</p>
            </div>
          )}

          {/* ── Failed / Expired — Retry ─────────────────── */}
          {modalState === 'failed' && (
            <div className="py-6">
              <AlertCircle className="w-14 h-14 text-red-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-800 mb-1">Connection Failed</p>
              <p className="text-xs text-gray-500 mb-6 max-w-xs mx-auto">{failReason}</p>
              <button
                onClick={handleCreateSession}
                className="btn btn-primary flex items-center gap-2 mx-auto"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
            </div>
          )}

          {/* ── Idle — initial prompt ─────────────────────── */}
          {modalState === 'idle' && (
            <>
              <QrCode className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-6 text-sm">
                Generate a QR code and scan it with WhatsApp to reconnect your account
              </p>
              <button
                onClick={handleCreateSession}
                className="btn btn-primary"
              >
                Generate QR Code
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  );
};

export default WhatsAppQRModal;