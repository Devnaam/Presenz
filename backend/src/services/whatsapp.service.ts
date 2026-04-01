import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  WASocket,
  proto,
  isJidBroadcast,
  delay
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { WhatsAppSession, FamilyContact, StudentStatus, Message, PersonalityProfile } from '../models';
import { SessionStatus, MessageDirection, MessageType, MessageStatus } from '../types';
import { logger, formatPhoneNumber, extractPhoneNumber, isMessageFromMe, getMessageText, getMessageType } from '../utils/baileys';
import { useMongoDBAuthState } from '../utils/mongoAuthState';
import { replyQueue } from '../config/queue';
import QRCode from 'qrcode';
import qrcodeTerminal from 'qrcode-terminal';


// Store active socket connections (in-memory during runtime)
const activeSockets = new Map<string, WASocket>();

// Track sessions currently attempting to reconnect
const reconnectingSet = new Set<string>();


/**
 * WhatsApp Service - Manages all Baileys operations
 */
class WhatsAppService {

  /**
   * Create a new WhatsApp session for a user
   */
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
          status: SessionStatus.PENDING_QR,
          qrCode: null,
          connectedAt: null,
          lastSeenAt: null
        },
        { upsert: true, new: true }
      );

      await this.initializeSocket(sessionId, userId);

      return { sessionId };

    } catch (error: any) {
      console.error('Error creating session:', error);
      throw new Error(`Failed to create session: ${error.message}`);
    }
  }


  /**
   * Initialize Baileys socket connection
   */
  private async initializeSocket(sessionId: string, userId: string): Promise<void> {
    try {
      const { version } = await fetchLatestBaileysVersion();
      const { state, saveCreds } = await useMongoDBAuthState(sessionId);

      const sock = makeWASocket({
        version,
        logger,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger)
        },
        generateHighQualityLinkPreview: true,
        keepAliveIntervalMs: 30000,
        connectTimeoutMs: 60000,
        getMessage: async (_key) => {
          return { conversation: '' };
        }
      });

      // Store socket in memory
      activeSockets.set(sessionId, sock);

      // Local flag to prevent duplicate close handling from same socket instance
      let closedOnce = false;

      // Handle connection updates
      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // QR code generated — print in terminal and save base64 for API
        if (qr) {
          qrcodeTerminal.generate(qr, { small: true });
          console.log(`📱 Scan the QR above with WhatsApp! (expires in ~60 seconds)`);

          const qrBase64 = await QRCode.toDataURL(qr);
          await WhatsAppSession.findOneAndUpdate(
            { sessionId },
            { qrCode: qrBase64, status: SessionStatus.PENDING_QR }
          );
        }

        // Connection established
        if (connection === 'open') {
          await saveCreds();
          reconnectingSet.delete(sessionId);

          await WhatsAppSession.findOneAndUpdate(
            { sessionId },
            {
              status: SessionStatus.CONNECTED,
              connectedAt: new Date(),
              lastSeenAt: new Date(),
              qrCode: null
            }
          );
          console.log(`✅ WhatsApp connected for session: ${sessionId}`);
        }

        // Connection closed
        if (connection === 'close') {
          if (closedOnce) return;
          closedOnce = true;

          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;
          const isRestartRequired = statusCode === DisconnectReason.restartRequired;

          console.log(`❌ Connection closed for session: ${sessionId}, statusCode: ${statusCode}`);

          activeSockets.delete(sessionId);

          if (isLoggedOut) {
            reconnectingSet.delete(sessionId);
            await WhatsAppSession.findOneAndUpdate(
              { sessionId },
              { status: SessionStatus.DISCONNECTED }
            );
            console.log(`🚪 Session logged out: ${sessionId}`);
            return;
          }

          if (reconnectingSet.has(sessionId)) return;
          reconnectingSet.add(sessionId);

          if (isRestartRequired) {
            console.log(`💾 Saving credentials before restart...`);
            await saveCreds();
            console.log(`✅ Credentials saved — reconnecting in 3s`);

            setTimeout(async () => {
              reconnectingSet.delete(sessionId);
              if (!activeSockets.has(sessionId)) {
                console.log(`🔄 Retrying connection for session: ${sessionId}`);
                await this.initializeSocket(sessionId, userId);
              }
            }, 3000);
          } else {
            setTimeout(async () => {
              reconnectingSet.delete(sessionId);
              if (!activeSockets.has(sessionId)) {
                console.log(`🔄 Retrying connection for session: ${sessionId}`);
                await this.initializeSocket(sessionId, userId);
              }
            }, 8000);
          }
        }
      });

      // Save credentials on every update
      sock.ev.on('creds.update', async () => {
        await saveCreds();
      });

      // Handle incoming messages — sessionId passed through
      sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type === 'notify') {
          for (const message of messages) {
            await this.handleIncomingMessage(message, userId, sessionId);
          }
        }
      });

      // Update last seen timestamp
      sock.ev.on('presence.update', async () => {
        await WhatsAppSession.findOneAndUpdate(
          { sessionId },
          { lastSeenAt: new Date() }
        );
      });

    } catch (error) {
      console.error('Error initializing socket:', error);
      throw error;
    }
  }


  /**
   * Handle incoming WhatsApp message
   */
  private async handleIncomingMessage(
    message: proto.IWebMessageInfo,
    userId: string,
    sessionId: string
  ): Promise<void> {
    try {
      // Ignore messages from self
      if (isMessageFromMe(message)) return;

      if (!message.key) return;

      // Ignore broadcast messages
      if (message.key.remoteJid && isJidBroadcast(message.key.remoteJid)) return;

      // Extract sender phone number
      const senderJid = message.key.remoteJid;
      if (!senderJid) return;

      const senderPhone = extractPhoneNumber(senderJid);
      console.log(`📨 Incoming message from: ${senderPhone}`);

      // VALIDATION CHECK 1: Is sender a family contact?
      const familyContact = await FamilyContact.findOne({
        userId,
        phone: { $regex: senderPhone, $options: 'i' }
      });

      if (!familyContact) {
        console.log(`⚠️ Message from unknown contact: ${senderPhone} - Ignoring`);
        return;
      }

      // VALIDATION CHECK 2: Is contact active?
      if (!familyContact.isActive) {
        console.log(`⚠️ Message from inactive contact: ${familyContact.name} - Ignoring`);
        return;
      }

      // Get message type and content
      const messageType = getMessageType(message);
      const messageText = getMessageText(message);

      if (messageType === 'other') {
        console.log(`⚠️ Unsupported message type from: ${familyContact.name}`);
        return;
      }

      // Save incoming message to database
      const savedMessage = await Message.create({
        userId,
        contactId: familyContact._id,
        direction: MessageDirection.INCOMING,
        type: messageType === 'voice' ? MessageType.VOICE_NOTE : MessageType.TEXT,
        originalContent: messageText || 'Voice message',
        status: MessageStatus.RECEIVED,
        whatsappMessageId: message.key.id ?? undefined,
        timestamp: new Date((message.messageTimestamp as number) * 1000)
      });

      console.log(`✅ Message saved: ${savedMessage._id}`);

      // VALIDATION CHECK 3: Is student away?
      const studentStatus = await StudentStatus.findOne({ userId });

      if (!studentStatus || studentStatus.mode === 'available') {
        console.log(`ℹ️ Student is available - No auto-reply needed`);
        return;
      }

      // VALIDATION CHECK 4: Does personality profile exist?
      const profile = await PersonalityProfile.findOne({
        userId,
        contactId: familyContact._id
      });

      if (!profile || !profile.systemPrompt) {
        console.log(`⚠️ No personality profile found for ${familyContact.name}`);
        return;
      }

      // All checks passed - Push to reply queue
      console.log(`📬 Queuing message for AI reply`);

      await replyQueue.add('generate-reply', {
        userId,
        contactId: familyContact._id.toString(),
        messageId: savedMessage._id.toString(),
        messageText: messageText || 'Voice message',
        messageType: messageType === 'voice' ? 'voice' : 'text',
        sessionId
      });

    } catch (error) {
      console.error('Error handling incoming message:', error);
    }
  }


  /**
   * Send a text message via WhatsApp
   */
  async sendMessage(userId: string, phoneNumber: string, text: string): Promise<boolean> {
    try {
      const session = await WhatsAppSession.findOne({ userId, status: SessionStatus.CONNECTED });

      if (!session) {
        throw new Error('No active WhatsApp session found');
      }

      const sock = activeSockets.get(session.sessionId);

      if (!sock) {
        throw new Error('Socket not found - please reconnect');
      }

      const jid = formatPhoneNumber(phoneNumber);
      await sock.sendMessage(jid, { text });

      console.log(`✅ Message sent to: ${phoneNumber}`);
      return true;

    } catch (error: any) {
      console.error('Error sending message:', error);
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }


  /**
   * Get current session status
   */
  async getSessionStatus(userId: string): Promise<{
    status: SessionStatus;
    qrCode?: string;
    connectedAt?: Date;
  }> {
    const session = await WhatsAppSession.findOne({ userId });

    if (!session) {
      throw new Error('No session found for user');
    }

    return {
      status: session.status,
      qrCode: session.qrCode || undefined,
      connectedAt: session.connectedAt || undefined
    };
  }


  /**
   * Disconnect and logout from WhatsApp
   */
  async disconnectSession(userId: string): Promise<void> {
    const session = await WhatsAppSession.findOne({ userId });

    if (!session) {
      throw new Error('No session found');
    }

    const sock = activeSockets.get(session.sessionId);

    if (sock) {
      await sock.logout();
      activeSockets.delete(session.sessionId);
    }

    await WhatsAppSession.findOneAndUpdate(
      { userId },
      { status: SessionStatus.DISCONNECTED, qrCode: null }
    );

    console.log(`🔌 Session disconnected for user: ${userId}`);
  }


  /**
   * Restore existing sessions on server restart
   */
  async restoreAllSessions(): Promise<void> {
    try {
      const connectedSessions = await WhatsAppSession.find({
        status: SessionStatus.CONNECTED
      });

      console.log(`🔄 Restoring ${connectedSessions.length} sessions...`);

      for (const session of connectedSessions) {
        try {
          await this.initializeSocket(session.sessionId, session.userId.toString());
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