import { WhatsAppSession } from '../models';
import { SessionStatus } from '../types';
import { formatPhoneNumber } from '../utils/baileys';
import { delay } from '@whiskeysockets/baileys';
import socketManager, { activeSockets } from './whatsapp.socket';


// ─────────────────────────────────────────────────────────────────
class WhatsAppService {


  // ── Create a new WhatsApp session for a user ──────────────────
  async createSession(userId: string): Promise<{ sessionId: string; qrCode?: string }> {
    try {
      const existingSession = await WhatsAppSession.findOne({ userId });

      if (existingSession && existingSession.status === SessionStatus.CONNECTED) {
        throw new Error('User already has an active WhatsApp session');
      }

      const sessionId = `session_${userId}_${Date.now()}`;

      await WhatsAppSession.findOneAndUpdate(
        { userId },
        {
          userId,
          sessionId,
          status:       SessionStatus.PENDING_QR,
          qrCode:       null,
          connectedAt:  null,
          lastSeenAt:   null,
          connectedPhone: null,
        },
        { upsert: true, new: true }
      );

      await socketManager.initializeSocket(sessionId, userId);

      return { sessionId };

    } catch (error: any) {
      console.error('Error creating session:', error);
      throw new Error(`Failed to create session: ${error.message}`);
    }
  }


  // ── Send a text message ───────────────────────────────────────
  async sendMessage(userId: string, phoneNumber: string, text: string): Promise<boolean> {
    try {
      const session = await WhatsAppSession.findOne({
        userId,
        status: SessionStatus.CONNECTED,
      });

      if (!session) throw new Error('No active WhatsApp session found');

      const sock = activeSockets.get(session.sessionId);
      if (!sock)  throw new Error('Socket not found — please reconnect');

      const jid = formatPhoneNumber(phoneNumber);
      console.log(`📤 [SEND] Sending message to JID: ${jid}`);
      await sock.sendMessage(jid, { text });

      console.log(`✅ [SEND] Message sent to: ${phoneNumber}`);
      return true;

    } catch (error: any) {
      console.error('❌ [SEND] Error sending message:', error);
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }


  // ── Mark a WhatsApp message as read ──────────────────────────
  async markAsRead(
    userId:             string,
    phoneNumber:        string,
    whatsappMessageId:  string | undefined
  ): Promise<void> {
    try {
      if (!whatsappMessageId) return;

      const session = await WhatsAppSession.findOne({
        userId,
        status: SessionStatus.CONNECTED,
      });
      if (!session) return;

      const sock = activeSockets.get(session.sessionId);
      if (!sock)  return;

      const jid = formatPhoneNumber(phoneNumber);
      await sock.readMessages([{
        remoteJid: jid,
        id:        whatsappMessageId,
        fromMe:    false,
      }]);

    } catch (error) {
      // Non-critical — log but don't throw
      console.error('❌ [READ] Error marking message as read:', error);
    }
  }


  // ── Show "typing..." indicator ────────────────────────────────
  async sendTypingIndicator(userId: string, phoneNumber: string): Promise<void> {
    try {
      const session = await WhatsAppSession.findOne({
        userId,
        status: SessionStatus.CONNECTED,
      });
      if (!session) return;

      const sock = activeSockets.get(session.sessionId);
      if (!sock)  return;

      const jid = formatPhoneNumber(phoneNumber);
      await sock.sendPresenceUpdate('composing', jid);

    } catch (error) {
      console.error('❌ [TYPING] Error sending typing indicator:', error);
    }
  }


  // ── Stop "typing..." indicator ────────────────────────────────
  async stopTypingIndicator(userId: string, phoneNumber: string): Promise<void> {
    try {
      const session = await WhatsAppSession.findOne({
        userId,
        status: SessionStatus.CONNECTED,
      });
      if (!session) return;

      const sock = activeSockets.get(session.sessionId);
      if (!sock)  return;

      const jid = formatPhoneNumber(phoneNumber);
      await sock.sendPresenceUpdate('paused', jid);

    } catch (error) {
      console.error('❌ [TYPING] Error stopping typing indicator:', error);
    }
  }


  // ── Get current session status ────────────────────────────────
  async getSessionStatus(userId: string): Promise<{
    status:       SessionStatus;
    qrCode?:      string;
    connectedAt?: Date;
  }> {
    const session = await WhatsAppSession.findOne({ userId });

    if (!session) {
      throw new Error('No session found for user');
    }

    return {
      status:      session.status,
      qrCode:      session.qrCode      || undefined,
      connectedAt: session.connectedAt || undefined,
    };
  }


  // ── Disconnect and logout ─────────────────────────────────────
  async disconnectSession(userId: string): Promise<void> {
    const session = await WhatsAppSession.findOne({ userId });

    if (!session) throw new Error('No session found');

    const sock = activeSockets.get(session.sessionId);

    if (sock) {
      await sock.logout();
      activeSockets.delete(session.sessionId);
    }

    await WhatsAppSession.findOneAndUpdate(
      { userId },
      {
        status:         SessionStatus.DISCONNECTED,
        qrCode:         null,
        connectedPhone: null,
      }
    );

    console.log(`🔌 [SOCKET] Session disconnected for user: ${userId}`);
  }


  // ── Restore all connected sessions on server restart ─────────
  async restoreAllSessions(): Promise<void> {
    try {
      const connectedSessions = await WhatsAppSession.find({
        status: SessionStatus.CONNECTED,
      });

      console.log(`🔄 Restoring ${connectedSessions.length} sessions...`);

      for (const session of connectedSessions) {
        try {
          await socketManager.initializeSocket(
            session.sessionId,
            session.userId.toString()
          );
          await delay(2000);
        } catch (error) {
          console.error(`Failed to restore session: ${session.sessionId}`, error);
        }
      }

      console.log(`✅ Session restoration complete`);
    } catch (error) {
      console.error('Error restoring sessions:', error);
    }
  }
}


export default new WhatsAppService();