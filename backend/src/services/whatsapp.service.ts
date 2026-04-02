import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  WASocket,
  proto,
  isJidBroadcast,
  delay,
  downloadMediaMessage
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { WhatsAppSession, FamilyContact, StudentStatus, Message, PersonalityProfile } from '../models';
import { SessionStatus, MessageDirection, MessageType, MessageStatus } from '../types';
import { logger, formatPhoneNumber, extractPhoneNumber, isMessageFromMe, getMessageText, getMessageType, normalizePhoneNumber } from '../utils/baileys';
import { useMongoDBAuthState } from '../utils/mongoAuthState';
import { replyQueue, voiceQueue } from '../config/queue';
import QRCode from 'qrcode';
import qrcodeTerminal from 'qrcode-terminal';


// Store active socket connections (in-memory during runtime)
const activeSockets = new Map<string, WASocket>();


// Track sessions currently attempting to reconnect
const reconnectingSet = new Set<string>();


// LID → phone number resolution map (per session, in-memory)
const lidMaps = new Map<string, Map<string, string>>();


// Buffer for @lid messages that arrived before the LID map was loaded
const pendingLidMessages = new Map<string, Array<{
  message: proto.IWebMessageInfo;
  userId: string;
  sessionId: string;
}>>();



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
   * Load LID map from MongoDB into memory for a session
   * Called on every startup/restore so buffered messages can be resolved immediately
   */
  private async loadLidMapFromDB(sessionId: string): Promise<void> {
    try {
      const session = await WhatsAppSession.findOne({ sessionId });
      const storedMap = (session as any)?.lidMap;


      if (storedMap && typeof storedMap === 'object') {
        const entries = Object.entries(storedMap) as [string, string][];
        if (entries.length > 0) {
          const map = new Map<string, string>(entries);
          lidMaps.set(sessionId, map);
          console.log(`📂 [LID] Loaded ${map.size} LID mappings from MongoDB`);
        } else {
          console.log(`📂 [LID] No saved LID mappings found in MongoDB yet`);
        }
      } else {
        console.log(`📂 [LID] No LID map field in session document yet`);
      }
    } catch (error) {
      console.error('❌ [LID] Error loading LID map from DB:', error);
    }
  }



  /**
   * Save current in-memory LID map to MongoDB so it survives restarts
   */
  private async saveLidMapToDB(sessionId: string): Promise<void> {
    try {
      const lidMap = lidMaps.get(sessionId);
      if (!lidMap || lidMap.size === 0) return;


      // Convert Map to plain object for MongoDB storage
      const mapObject: Record<string, string> = {};
      lidMap.forEach((phone, lid) => {
        mapObject[lid] = phone;
      });


      await WhatsAppSession.findOneAndUpdate(
        { sessionId },
        { $set: { lidMap: mapObject } }
      );


      console.log(`💾 [LID] Saved ${lidMap.size} LID mappings to MongoDB`);
    } catch (error) {
      console.error('❌ [LID] Error saving LID map to DB:', error);
    }
  }



  /**
   * Initialize Baileys socket connection
   */
  private async initializeSocket(sessionId: string, userId: string): Promise<void> {
    try {
      // ✅ Load persisted LID map from MongoDB BEFORE connecting
      // This means buffered messages from @lid senders can be resolved
      // immediately on the next contacts event (or right away if map is loaded)
      await this.loadLidMapFromDB(sessionId);


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


      activeSockets.set(sessionId, sock);


      let closedOnce = false;


      sock.ev.on('connection.update', async (update) => {
        try {
          const { connection, lastDisconnect, qr } = update;


          if (qr) {
            qrcodeTerminal.generate(qr, { small: true });
            console.log(`📱 Scan the QR above with WhatsApp! (expires in ~60 seconds)`);


            const qrBase64 = await QRCode.toDataURL(qr);
            await WhatsAppSession.findOneAndUpdate(
              { sessionId },
              { qrCode: qrBase64, status: SessionStatus.PENDING_QR }
            );
          }


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
            console.log(`✅ [SOCKET] WhatsApp connected for session: ${sessionId}`);


            // ✅ After connection, replay any buffered messages using the loaded LID map
            await this.replayBuffered(sessionId);
          }


          if (connection === 'close') {
            if (closedOnce) return;
            closedOnce = true;


            const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
            const isLoggedOut = statusCode === DisconnectReason.loggedOut;
            const isRestartRequired = statusCode === DisconnectReason.restartRequired;


            console.log(`❌ [SOCKET] Connection closed for session: ${sessionId}, statusCode: ${statusCode}`);


            activeSockets.delete(sessionId);


            if (isLoggedOut) {
              reconnectingSet.delete(sessionId);
              lidMaps.delete(sessionId);
              pendingLidMessages.delete(sessionId);
              await WhatsAppSession.findOneAndUpdate(
                { sessionId },
                { status: SessionStatus.DISCONNECTED }
              );
              console.log(`🚪 [SOCKET] Session logged out: ${sessionId}`);
              return;
            }


            if (reconnectingSet.has(sessionId)) return;
            reconnectingSet.add(sessionId);


            if (isRestartRequired) {
              console.log(`💾 [SOCKET] Saving credentials before restart...`);
              await saveCreds();
              console.log(`✅ [SOCKET] Credentials saved — reconnecting in 3s`);
              setTimeout(async () => {
                reconnectingSet.delete(sessionId);
                if (!activeSockets.has(sessionId)) {
                  await this.initializeSocket(sessionId, userId);
                }
              }, 3000);
            } else {
              setTimeout(async () => {
                reconnectingSet.delete(sessionId);
                if (!activeSockets.has(sessionId)) {
                  await this.initializeSocket(sessionId, userId);
                }
              }, 8000);
            }
          }
        } catch (error) {
          console.error(`❌ [SOCKET] Error in connection.update handler:`, error);
        }
      });


      sock.ev.on('creds.update', async () => {
        try {
          await saveCreds();
        } catch (error) {
          console.error('❌ [CREDS] Error saving creds:', error);
        }
      });


      sock.ev.on('messages.upsert', async ({ messages, type }) => {
        console.log(`📥 [UPSERT] messages.upsert fired — type: ${type}, count: ${messages.length}`);
        if (type === 'notify') {
          for (const message of messages) {
            await this.handleIncomingMessage(message, userId, sessionId);
          }
        } else {
          console.log(`⏭️ [UPSERT] Skipping — type is "${type}", not "notify"`);
        }
      });


      sock.ev.on('presence.update', async () => {
        try {
          await WhatsAppSession.findOneAndUpdate(
            { sessionId },
            { lastSeenAt: new Date() }
          );
        } catch (error) {
          console.error('❌ [PRESENCE] Error updating presence:', error);
        }
      });


      // ─────────────────────────────────────────────────────────────────────
      // LID → phone resolution via contact events
      //
      // WhatsApp only sends the full contact list ONCE (on first QR scan).
      // On session restores, it never re-sends them. So we:
      //   1. Persist the LID map to MongoDB after the first successful load
      //   2. Load it from MongoDB on every restart (done above before connect)
      //   3. Still listen to all 4 events in case they do fire (e.g. new contacts)
      //      and update both the in-memory map and MongoDB when they do
      // ─────────────────────────────────────────────────────────────────────


      const processContacts = async (contacts: any[], source: string) => {
        if (!contacts?.length) return;


        if (!lidMaps.has(sessionId)) {
          lidMaps.set(sessionId, new Map());
        }
        const lidMap = lidMaps.get(sessionId)!;
        let newMappings = 0;


        for (const contact of contacts) {
          // Format A: { lid, id }
          if (contact.lid && contact.id) {
            const lid = contact.lid.split(':')[0].split('@')[0];
            const phone = contact.id.split(':')[0].split('@')[0];
            if (lid && phone && !lidMap.has(lid)) {
              lidMap.set(lid, phone);
              newMappings++;
            }
          }
          // Format B: { lidJid, pnJid } — Baileys v7+
          if (contact.lidJid && contact.pnJid) {
            const lid = contact.lidJid.split(':')[0].split('@')[0];
            const phone = contact.pnJid.split(':')[0].split('@')[0];
            if (lid && phone && !lidMap.has(lid)) {
              lidMap.set(lid, phone);
              newMappings++;
            }
          }
        }


        console.log(`📇 [LID] ${source} — +${newMappings} new mappings, total: ${lidMap.size}`);


        if (newMappings > 0) {
          // Persist to MongoDB so it survives restarts
          await this.saveLidMapToDB(sessionId);
          // Replay any buffered messages
          await this.replayBuffered(sessionId);
        }
      };


      // Event 1 — fresh QR scan
      sock.ev.on('contacts.upsert', async (contacts) => {
        await processContacts(contacts, 'contacts.upsert');
      });


      // Event 2 — session restore full list
      sock.ev.on('contacts.set' as any, async ({ contacts }: { contacts: any[] }) => {
        await processContacts(contacts, 'contacts.set');
      });


      // Event 3 — history sync (most reliable, includes lidPnMappings)
      sock.ev.on('messaging-history.set', async ({ contacts, lidPnMappings }: any) => {
        await processContacts(contacts || [], 'messaging-history contacts');


        if (lidPnMappings?.length) {
          if (!lidMaps.has(sessionId)) lidMaps.set(sessionId, new Map());
          const lidMap = lidMaps.get(sessionId)!;
          let newMappings = 0;


          for (const mapping of lidPnMappings) {
            const lid = (mapping.lid || '').split(':')[0].split('@')[0];
            const phone = (mapping.pn || '').split(':')[0].split('@')[0];
            if (lid && phone && !lidMap.has(lid)) {
              lidMap.set(lid, phone);
              newMappings++;
            }
          }


          console.log(`📇 [LID] lidPnMappings — +${newMappings} new mappings, total: ${lidMap.size}`);


          if (newMappings > 0) {
            await this.saveLidMapToDB(sessionId);
            await this.replayBuffered(sessionId);
          }
        }
      });


      // Event 4 — Baileys v7+ dedicated event
      sock.ev.on('lid-mapping.update' as any, async (mapping: any) => {
        if (mapping?.lid && mapping?.pn) {
          if (!lidMaps.has(sessionId)) lidMaps.set(sessionId, new Map());
          const lidMap = lidMaps.get(sessionId)!;
          const lid = mapping.lid.split(':')[0].split('@')[0];
          const phone = mapping.pn.split(':')[0].split('@')[0];
          if (lid && phone) {
            lidMap.set(lid, phone);
            console.log(`📇 [LID] lid-mapping.update: ${lid} → ${phone}`);
            await this.saveLidMapToDB(sessionId);
            await this.replayBuffered(sessionId);
          }
        }
      });


    } catch (error) {
      console.error('Error initializing socket:', error);
      throw error;
    }
  }



  /**
   * Replay messages buffered while LID map was not yet available
   */
  private async replayBuffered(sessionId: string): Promise<void> {
    const buffered = pendingLidMessages.get(sessionId);
    if (!buffered || buffered.length === 0) return;


    const lidMap = lidMaps.get(sessionId);
    if (!lidMap || lidMap.size === 0) {
      console.log(`⏳ [LID] replayBuffered called but LID map still empty — keeping ${buffered.length} messages buffered`);
      return;
    }


    console.log(`🔄 [LID] Replaying ${buffered.length} buffered message(s)...`);
    pendingLidMessages.delete(sessionId);


    for (const item of buffered) {
      await this.handleIncomingMessage(item.message, item.userId, item.sessionId);
    }


    console.log(`✅ [LID] All buffered messages replayed`);
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
      console.log(`\n──────────────────────────────────────────`);
      console.log(`📩 [MSG] New message received`);

      if (isMessageFromMe(message)) {
        console.log(`🔁 [MSG] Skipping — message is from self`);
        return;
      }

      if (!message.key) {
        console.log(`⚠️ [MSG] Skipping — message.key is null`);
        return;
      }

      const senderJid = message.key.remoteJid;
      if (!senderJid) {
        console.log(`⚠️ [MSG] Skipping — senderJid is null`);
        return;
      }

      console.log(`🔍 [MSG] Raw JID: ${senderJid}`);

      if (senderJid.endsWith('@g.us')) {
        console.log(`🔇 [MSG] Skipping — group message`);
        return;
      }

      if (isJidBroadcast(senderJid)) {
        console.log(`🔇 [MSG] Skipping — broadcast message`);
        return;
      }

      const senderPhone = extractPhoneNumber(senderJid);
      console.log(`📞 [MSG] Extracted phone: ${senderPhone}`);

      // ═══════════════════════════════════════════════════════════
      // ENHANCED LID RESOLUTION WITH FALLBACK MATCHING
      // ═══════════════════════════════════════════════════════════


      // Resolve @lid → real phone number
      let resolvedPhone = senderPhone;
      if (senderJid.endsWith('@lid')) {
        const lidMap = lidMaps.get(sessionId);
        console.log(`🔗 [LID] @lid detected — map size: ${lidMap?.size ?? 0}`);

        const resolved = lidMap?.get(senderPhone);
        if (!resolved) {
          if (!pendingLidMessages.has(sessionId)) {
            pendingLidMessages.set(sessionId, []);
          }
          pendingLidMessages.get(sessionId)!.push({ message, userId, sessionId });
          const total = pendingLidMessages.get(sessionId)!.length;
          console.log(`⏳ [LID] "${senderPhone}" not in map — buffered (total: ${total})`);
          console.log(`⚠️  [LID] LID map is empty. Do a fresh QR scan to populate it ONCE.`);
          console.log(`──────────────────────────────────────────\n`);
          return;
        }

        resolvedPhone = resolved;
        console.log(`✅ [LID] Resolved: ${senderPhone} → ${resolvedPhone}`);
      }

      console.log(`📨 [MSG] Processing message from: ${resolvedPhone}`);

      // ═══════════════════════════════════════════════════════════
      // CONTACT MATCHING (using resolved phone)
      // ═══════════════════════════════════════════════════════════
      const senderNormalized = normalizePhoneNumber(resolvedPhone);
      console.log(`🔤 [CONTACT] Normalized sender: ${senderNormalized}`);

      const allContacts = await FamilyContact.find({ userId, isActive: true });
      console.log(`👥 [CONTACT] Active contacts in DB: ${allContacts.length}`);

      allContacts.forEach(c => {
        console.log(`   └─ ${c.name}: stored="${c.phone}" normalized="${normalizePhoneNumber(c.phone)}"`);
      });

      const familyContact = allContacts.find(c => {
        const storedNormalized = normalizePhoneNumber(c.phone);
        return (
          storedNormalized === senderNormalized ||
          senderNormalized.endsWith(storedNormalized) ||
          storedNormalized.endsWith(senderNormalized)
        );
      }) || null;

      if (!familyContact) {
        console.log(`❌ [CONTACT] No match found for "${resolvedPhone}" — ignoring`);
        console.log(`💡 [HINT] Add this number as a FamilyContact: ${resolvedPhone}`);
        console.log(`──────────────────────────────────────────\n`);
        return;
      }

      console.log(`✅ [CONTACT] Matched contact: ${familyContact.name} (id: ${familyContact._id})`);
      console.log(`🔬 [DEBUG] message.message keys:`, JSON.stringify(Object.keys(message.message || {})));
      const messageType = getMessageType(message);
      console.log(`📝 [MSG] Message type: ${messageType}`);

      if (messageType === 'other') {
        console.log(`⚠️ [MSG] Unsupported message type — ignoring`);
        return;
      }

      // Handle TEXT messages
      if (messageType === 'text') {
        const messageText = getMessageText(message);
        console.log(`💬 [MSG] Message text: "${messageText}"`);

        if (!messageText) {
          console.log(`⚠️ [MSG] Empty text — ignoring`);
          return;
        }

        const savedMessage = await Message.create({
          userId,
          contactId: familyContact._id,
          direction: MessageDirection.INCOMING,
          type: MessageType.TEXT,
          originalContent: messageText,
          status: MessageStatus.RECEIVED,
          whatsappMessageId: message.key.id ?? undefined,
          timestamp: new Date((message.messageTimestamp as number) * 1000)
        }) as any;

        console.log(`💾 [DB] Text message saved: ${savedMessage._id}`);

        await this.checkAndQueueReply(
          userId,
          familyContact._id,
          savedMessage._id.toString(),
          messageText,
          'text'
        );
      }

      // Handle VOICE messages
      if (messageType === 'voice') {
        console.log(`🎤 [MSG] Voice note received from: ${familyContact.name}`);

        const savedMessage = await Message.create({
          userId,
          contactId: familyContact._id,
          direction: MessageDirection.INCOMING,
          type: MessageType.VOICE_NOTE,
          originalContent: 'Voice note (processing...)',
          status: MessageStatus.RECEIVED,
          whatsappMessageId: message.key.id ?? undefined,
          timestamp: new Date((message.messageTimestamp as number) * 1000)
        }) as any;

        console.log(`💾 [DB] Voice note saved: ${savedMessage._id}`);

        const shouldProcess = await this.shouldProcessMessage(userId, familyContact._id);

        if (!shouldProcess) {
          console.log(`⏭️ [VOICE] Not processing — student available or no profile`);
          return;
        }

        try {
          const sock = this.getSocket(sessionId);
          const downloadOptions: any = {
            logger,
            ...(sock && { reuploadRequest: sock.updateMediaMessage })
          };

          console.log(`📥 [VOICE] Downloading voice note...`);
          const buffer = await downloadMediaMessage(
            message as any,
            'buffer',
            {},
            downloadOptions
          ) as Buffer;

          console.log(`✅ [VOICE] Downloaded: ${buffer.length} bytes`);

          await voiceQueue.add('transcribe-voice', {
            userId,
            contactId: familyContact._id.toString(),
            messageId: savedMessage._id.toString(),
            audioBuffer: buffer.toString('base64')
          });

          console.log(`📬 [QUEUE] Voice note queued for transcription`);

        } catch (error) {
          console.error('❌ [VOICE] Error downloading voice note:', error);
          await Message.findByIdAndUpdate(savedMessage._id, {
            status: MessageStatus.FAILED,
            originalContent: 'Voice note (download failed)'
          });
        }
      }

      console.log(`──────────────────────────────────────────\n`);

    } catch (error) {
      console.error('❌ [MSG] Error handling incoming message:', error);
    }
  }



  /**
   * Check if message should be processed and queue for reply
   */
  private async checkAndQueueReply(
    userId: string,
    contactId: any,
    messageId: string,
    messageText: string,
    messageType: 'text' | 'voice'
  ): Promise<void> {
    console.log(`\n🔎 [REPLY] Running reply checks...`);


    // GATE 1: Is student away?
    const studentStatus = await StudentStatus.findOne({ userId });
    console.log(`🎓 [REPLY] Student status: ${studentStatus ? `mode="${studentStatus.mode}"` : 'NOT FOUND in DB'}`);


    if (!studentStatus || studentStatus.mode === 'available') {
      console.log(`⏭️ [REPLY] BLOCKED — student is available. Set status to Away to enable auto-reply`);
      return;
    }


    console.log(`✅ [REPLY] Gate 1 passed — student is away (mode: ${studentStatus.mode})`);


    // GATE 2: Does personality profile exist?
    const profile = await PersonalityProfile.findOne({ userId, contactId });
    console.log(`🧠 [REPLY] Personality profile: ${profile ? `found (id: ${profile._id})` : 'NOT FOUND in DB'}`);


    if (!profile) {
      console.log(`⏭️ [REPLY] BLOCKED — no personality profile for this contact. Create one in the dashboard`);
      return;
    }


    if (!profile.systemPrompt) {
      console.log(`⏭️ [REPLY] BLOCKED — personality profile exists but systemPrompt is empty`);
      return;
    }


    console.log(`✅ [REPLY] Gate 2 passed — personality profile has systemPrompt`);


    const job = await replyQueue.add('generate-reply', {
      userId,
      contactId: contactId.toString(),
      messageId,
      messageText,
      messageType
    });


    console.log(`🚀 [QUEUE] Message added to replyQueue — job id: ${job.id}`);
    console.log(`💬 [QUEUE] Text: "${messageText}"`);
  }



  /**
   * Check if message should be processed (for voice notes)
   */
  private async shouldProcessMessage(userId: string, contactId: any): Promise<boolean> {
    const studentStatus = await StudentStatus.findOne({ userId });


    if (!studentStatus || studentStatus.mode === 'available') {
      console.log(`ℹ️ [VOICE] Student is available - Saving but not processing voice note`);
      return false;
    }


    const profile = await PersonalityProfile.findOne({ userId, contactId });


    if (!profile || !profile.systemPrompt) {
      console.log(`⚠️ [VOICE] No personality profile - Saving but not processing voice note`);
      return false;
    }


    return true;
  }



  /**
   * Get socket for session ID
   */
  private getSocket(sessionId: string): WASocket | undefined {
    return activeSockets.get(sessionId);
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
      console.log(`📤 [SEND] Sending message to JID: ${jid}`);
      await sock.sendMessage(jid, { text });


      console.log(`✅ [SEND] Message sent to: ${phoneNumber}`);
      return true;


    } catch (error: any) {
      console.error('❌ [SEND] Error sending message:', error);
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }


  /**
 * Mark a WhatsApp message as read.
 * Called before starting to type — mirrors real human behavior.
 */
  async markAsRead(
    userId: string,
    phoneNumber: string,
    whatsappMessageId: string | undefined
  ): Promise<void> {
    try {
      if (!whatsappMessageId) return;

      const session = await WhatsAppSession.findOne({
        userId,
        status: SessionStatus.CONNECTED
      });
      if (!session) return;

      const sock = activeSockets.get(session.sessionId);
      if (!sock) return;

      const jid = formatPhoneNumber(phoneNumber);
      await sock.readMessages([{
        remoteJid: jid,
        id: whatsappMessageId,
        fromMe: false
      }]);

    } catch (error) {
      // Non-critical — log but don't throw
      console.error('❌ [READ] Error marking message as read:', error);
    }
  }


  /**
   * Show "typing..." indicator to the other person.
   * Call this before generating/sending a reply.
   */
  async sendTypingIndicator(userId: string, phoneNumber: string): Promise<void> {
    try {
      const session = await WhatsAppSession.findOne({
        userId,
        status: SessionStatus.CONNECTED
      });
      if (!session) return;

      const sock = activeSockets.get(session.sessionId);
      if (!sock) return;

      const jid = formatPhoneNumber(phoneNumber);
      await sock.sendPresenceUpdate('composing', jid);

    } catch (error) {
      console.error('❌ [TYPING] Error sending typing indicator:', error);
    }
  }


  /**
   * Stop "typing..." indicator.
   * Call this after all message parts are sent, or on error.
   */
  async stopTypingIndicator(userId: string, phoneNumber: string): Promise<void> {
    try {
      const session = await WhatsAppSession.findOne({
        userId,
        status: SessionStatus.CONNECTED
      });
      if (!session) return;

      const sock = activeSockets.get(session.sessionId);
      if (!sock) return;

      const jid = formatPhoneNumber(phoneNumber);
      await sock.sendPresenceUpdate('paused', jid);

    } catch (error) {
      console.error('❌ [TYPING] Error stopping typing indicator:', error);
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


    lidMaps.delete(session.sessionId);
    pendingLidMessages.delete(session.sessionId);


    await WhatsAppSession.findOneAndUpdate(
      { userId },
      { status: SessionStatus.DISCONNECTED, qrCode: null }
    );


    console.log(`🔌 [SOCKET] Session disconnected for user: ${userId}`);
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