import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  WASocket,
  proto,
  isJidBroadcast,
  downloadMediaMessage
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import {
  WhatsAppSession,
  FamilyContact,
  StudentStatus,
  Message,
  PersonalityProfile,
  User,
} from '../models';
import { SessionStatus, MessageDirection, MessageType, MessageStatus } from '../types';
import {
  logger,
  extractPhoneNumber,
  isMessageFromMe,
  getMessageText,
  getMessageType,
  normalizePhoneNumber,
} from '../utils/baileys';
import { useMongoDBAuthState } from '../utils/mongoAuthState';
import { replyQueue, voiceQueue } from '../config/queue';
import QRCode from 'qrcode';
import qrcodeTerminal from 'qrcode-terminal';
import activityService from './activity.service';


// ─────────────────────────────────────────────────────────────────
// In-memory runtime maps
// ─────────────────────────────────────────────────────────────────

// Active Baileys socket connections
export const activeSockets = new Map() as Map<string, WASocket>;

// Sessions currently attempting to reconnect (prevents double reconnect)
const reconnectingSet = new Set<string>();

// Initialization lock — prevents duplicate socket creation for same session
const connectingMap = new Set<string>();

// 440 retry counter per session — reserved for future exponential backoff use
const reconnectAttempts = new Map<string, number>();

// LID → phone number resolution map (per session)
const lidMaps = new Map<string, Map<string, string>>();

// Buffer for @lid messages that arrived before LID map was loaded
const pendingLidMessages = new Map<string, Array<{
  message: proto.IWebMessageInfo;
  userId: string;
  sessionId: string;
}>>();


// ─────────────────────────────────────────────────────────────────
class SocketManager {


  // ── Public: get active socket for a session ───────────────────
  getSocket(sessionId: string): WASocket | undefined {
    return activeSockets.get(sessionId);
  }


  // ── Load LID map from MongoDB into memory ─────────────────────
  async loadLidMapFromDB(sessionId: string): Promise<void> {
    try {
      // Skip DB query if map already loaded in memory
      if (lidMaps.has(sessionId)) {
        console.log(`📂 [LID] Already in memory (${lidMaps.get(sessionId)!.size} mappings) — skipping DB query`);
        return;
      }

      const session = await WhatsAppSession.findOne({ sessionId });
      const storedMap = (session as any)?.lidMap;

      if (storedMap && typeof storedMap === 'object') {
        const entries = Object.entries(storedMap) as [string, string][];
        if (entries.length > 0) {
          lidMaps.set(sessionId, new Map<string, string>(entries));
          console.log(`📂 [LID] Loaded ${entries.length} LID mappings from MongoDB`);
        } else {
          console.log(`📂 [LID] No saved LID mappings in MongoDB yet`);
        }
      } else {
        console.log(`📂 [LID] No LID map field in session document yet`);
      }
    } catch (error) {
      console.error('❌ [LID] Error loading LID map from DB:', error);
    }
  }


  // ── Persist in-memory LID map to MongoDB ─────────────────────
  async saveLidMapToDB(sessionId: string): Promise<void> {
    try {
      const lidMap = lidMaps.get(sessionId);
      if (!lidMap || lidMap.size === 0) return;

      const mapObject: Record<string, string> = {};
      lidMap.forEach((phone, lid) => { mapObject[lid] = phone; });

      await WhatsAppSession.findOneAndUpdate(
        { sessionId },
        { $set: { lidMap: mapObject } }
      );

      console.log(`💾 [LID] Saved ${lidMap.size} LID mappings to MongoDB`);
    } catch (error) {
      console.error('❌ [LID] Error saving LID map to DB:', error);
    }
  }


  // ── Replay messages buffered while LID map was empty ──────────
  async replayBuffered(sessionId: string): Promise<void> {
    const buffered = pendingLidMessages.get(sessionId);
    if (!buffered || buffered.length === 0) return;

    const lidMap = lidMaps.get(sessionId);
    if (!lidMap || lidMap.size === 0) {
      console.log(`⏳ [LID] replayBuffered — LID map still empty, keeping ${buffered.length} buffered`);
      return;
    }

    console.log(`🔄 [LID] Replaying ${buffered.length} buffered message(s)...`);
    pendingLidMessages.delete(sessionId);

    for (const item of buffered) {
      await this.handleIncomingMessage(item.message, item.userId, item.sessionId);
    }

    console.log(`✅ [LID] All buffered messages replayed`);
  }


  // ── Initialize Baileys socket ─────────────────────────────────
  async initializeSocket(sessionId: string, userId: string): Promise<void> {
    try {
      // Initialization lock — prevents duplicate socket creation
      if (connectingMap.has(sessionId)) {
        console.log(`⏳ [SOCKET] Already initializing: ${sessionId} — skipping duplicate call`);
        return;
      }
      connectingMap.add(sessionId);

      // Terminate any stale socket before creating new one
      const staleSocket = activeSockets.get(sessionId);
      if (staleSocket) {
        try { staleSocket.end(undefined); } catch { }
        activeSockets.delete(sessionId);
      }

      // Load persisted LID map BEFORE connecting
      await this.loadLidMapFromDB(sessionId);

      const { version } = await fetchLatestBaileysVersion();
      const { state, saveCreds } = await useMongoDBAuthState(sessionId);

      const sock = makeWASocket({
        version,
        logger,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        generateHighQualityLinkPreview: true,
        keepAliveIntervalMs: 30000,
        connectTimeoutMs: 60000,
        getMessage: async (_key) => ({ conversation: '' }),
      });

      activeSockets.set(sessionId, sock);

      let closedOnce = false;


      // ─── connection.update ───────────────────────────────────
      sock.ev.on('connection.update', async (update) => {
        try {
          const { connection, lastDisconnect, qr } = update;

          // ── QR generated ────────────────────────────────────
          if (qr) {
            qrcodeTerminal.generate(qr, { small: true });
            console.log(`📱 Scan the QR above with WhatsApp! (expires in ~60 seconds)`);

            const qrBase64 = await QRCode.toDataURL(qr);
            await WhatsAppSession.findOneAndUpdate(
              { sessionId },
              { qrCode: qrBase64, status: SessionStatus.PENDING_QR }
            );
          }

          // ── Connection opened ────────────────────────────────
          if (connection === 'open') {
            await saveCreds();
            reconnectingSet.delete(sessionId);
            // Release init lock + reset 440 counter on successful connect
            connectingMap.delete(sessionId);
            reconnectAttempts.delete(sessionId);

            // ══════════════════════════════════════════════════
            // LAYER 2 + 3: WhatsApp number ownership validation
            // Runs BEFORE marking session as CONNECTED
            // ══════════════════════════════════════════════════
            const rawId = sock.user?.id ?? null;
            const connectedPhone = rawId
              ? rawId.split(':')[0].split('@')[0]
              : null;

            console.log(`🔐 [AUTH] Connected WA phone: ${connectedPhone}`);

            if (connectedPhone) {
              const connectedNormalized = normalizePhoneNumber(connectedPhone);

              // ── Layer 2: Connected number must match registered phone ──
              const user = await User.findById(userId);
              if (user) {
                const registeredNormalized = normalizePhoneNumber(user.phone);
                const phoneMatches =
                  registeredNormalized === connectedNormalized ||
                  connectedNormalized.endsWith(registeredNormalized) ||
                  registeredNormalized.endsWith(connectedNormalized);

                if (!phoneMatches) {
                  console.error(
                    `🚫 [AUTH] Phone mismatch — registered: ${registeredNormalized}, ` +
                    `connected: ${connectedNormalized}. Rejecting session.`
                  );
                  try { await sock.logout(); } catch { }
                  activeSockets.delete(sessionId);
                  connectingMap.delete(sessionId);
                  await WhatsAppSession.findOneAndUpdate(
                    { sessionId },
                    { status: SessionStatus.DISCONNECTED, qrCode: null }
                  );
                  await activityService.log({
                    userId,
                    type: 'whatsapp.rejected',
                    title: 'Connection Rejected',
                    description: `Phone mismatch — connected number did not match your registered phone`,
                    metadata: { connectedPhone: connectedNormalized, sessionId },
                  });
                  return;
                }
                console.log(`✅ [AUTH] Layer 2 passed — phone match confirmed`);
              }

              // ── Layer 3: Same WA number must not be active on another account ──
              const alreadyClaimed = await WhatsAppSession.findOne({
                connectedPhone: connectedNormalized,
                userId: { $ne: userId },
                status: SessionStatus.CONNECTED,
              });

              if (alreadyClaimed) {
                console.error(
                  `🚫 [AUTH] WA number ${connectedNormalized} already active on ` +
                  `another account (userId: ${alreadyClaimed.userId}). Rejecting.`
                );
                try { await sock.logout(); } catch { }
                activeSockets.delete(sessionId);
                connectingMap.delete(sessionId);
                await WhatsAppSession.findOneAndUpdate(
                  { sessionId },
                  { status: SessionStatus.DISCONNECTED, qrCode: null }
                );
                return;
              }
              console.log(`✅ [AUTH] Layer 3 passed — WA number not claimed by another account`);
              await activityService.log({
                userId,
                type: 'whatsapp.connected',
                title: 'WhatsApp Connected',
                description: `+${connectedNormalized} connected successfully`,
                metadata: { phone: connectedNormalized, sessionId },
              });

              // ── Both layers passed — mark CONNECTED ──────────
              await WhatsAppSession.findOneAndUpdate(
                { sessionId },
                {
                  status: SessionStatus.CONNECTED,
                  connectedAt: new Date(),
                  lastSeenAt: new Date(),
                  qrCode: null,
                  connectedPhone: connectedNormalized,
                }
              );

            } else {
              // connectedPhone unavailable — still mark connected (fallback)
              await WhatsAppSession.findOneAndUpdate(
                { sessionId },
                {
                  status: SessionStatus.CONNECTED,
                  connectedAt: new Date(),
                  lastSeenAt: new Date(),
                  qrCode: null,
                }
              );
            }

            console.log(`✅ [SOCKET] WhatsApp connected for session: ${sessionId}`);
            await this.replayBuffered(sessionId);
          }


          // ── Connection closed ────────────────────────────────
          if (connection === 'close') {
            if (closedOnce) return;
            closedOnce = true;

            const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
            const isLoggedOut          = statusCode === DisconnectReason.loggedOut;
            const isRestartRequired    = statusCode === DisconnectReason.restartRequired;
            const isConnectionReplaced = statusCode === 440;

            console.log(`❌ [SOCKET] Connection closed — session: ${sessionId}, code: ${statusCode}`);
            activeSockets.delete(sessionId);
            // Always release init lock on close so session can be re-initialized
            connectingMap.delete(sessionId);

            // ── LOGGED OUT ────────────────────────────────────
            if (isLoggedOut) {
              reconnectingSet.delete(sessionId);
              reconnectAttempts.delete(sessionId);
              lidMaps.delete(sessionId);
              pendingLidMessages.delete(sessionId);
              await WhatsAppSession.findOneAndUpdate(
                { sessionId },
                { status: SessionStatus.DISCONNECTED }
              );
              await activityService.log({
                userId,
                type: 'whatsapp.disconnected',
                title: 'WhatsApp Disconnected',
                description: 'Session was logged out',
                metadata: { sessionId, reason: 'logged_out' },
              });
              console.log(`🚪 [SOCKET] Session logged out: ${sessionId}`);
              return;
            }

            // ── CONNECTION REPLACED (440) ─────────────────────
            // Another device/browser took over this account.
            // DO NOT reconnect — that starts an infinite war.
            // Mark disconnected — user must close WA Web and reconnect manually.
            if (isConnectionReplaced) {
              reconnectingSet.delete(sessionId);
              reconnectAttempts.delete(sessionId);
              await WhatsAppSession.findOneAndUpdate(
                { sessionId },
                { status: SessionStatus.DISCONNECTED, qrCode: null }
              );
              await activityService.log({
                userId,
                type: 'whatsapp.rejected',        // ← valid ActivityEventType
                title: 'Session Replaced',
                description: 'Another device connected to your WhatsApp. Close WhatsApp Web and reconnect from Presenz.',
                metadata: { sessionId, reason: 'connection_replaced_440' },
              });
              console.log(`⚔️  [SOCKET] Code 440 — NOT reconnecting. User must close WhatsApp Web and reconnect manually.`);
              return;  // ← CRITICAL — no reconnect attempt
            }

            // ── PREVENT DOUBLE RECONNECT ──────────────────────
            if (reconnectingSet.has(sessionId)) return;
            reconnectingSet.add(sessionId);

            // ── RESTART REQUIRED ──────────────────────────────
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
              return;
            }

            // ── ALL OTHER ERRORS — reconnect with backoff ─────
            console.log(`⚠️  [SOCKET] Unknown disconnect (code: ${statusCode}) — retrying in 8s`);
            setTimeout(async () => {
              reconnectingSet.delete(sessionId);
              if (!activeSockets.has(sessionId)) {
                await this.initializeSocket(sessionId, userId);
              }
            }, 8000);
          }

        } catch (error) {
          console.error(`❌ [SOCKET] Error in connection.update handler:`, error);
        }
      });


      // ─── creds.update ────────────────────────────────────────
      sock.ev.on('creds.update', async () => {
        try {
          await saveCreds();
        } catch (error) {
          console.error('❌ [CREDS] Error saving creds:', error);
        }
      });


      // ─── messages.upsert ─────────────────────────────────────
      sock.ev.on('messages.upsert', async ({ messages, type }) => {
        console.log(`📥 [UPSERT] fired — type: ${type}, count: ${messages.length}`);
        if (type === 'notify') {
          for (const message of messages) {
            await this.handleIncomingMessage(message, userId, sessionId);
          }
        } else {
          console.log(`⏭️ [UPSERT] Skipping — type is "${type}", not "notify"`);
        }
      });


      // ─── presence.update ─────────────────────────────────────
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


      // ─────────────────────────────────────────────────────────
      // LID → phone resolution via contact events
      //
      // WhatsApp only sends the full contact list ONCE (on first QR scan).
      // On session restores, it never re-sends them. So we:
      // 1. Persist the LID map to MongoDB after first successful load
      // 2. Load from MongoDB on every restart (done above before connect)
      // 3. Still listen to all 4 events in case they do fire (new contacts)
      // ─────────────────────────────────────────────────────────

      const processContacts = async (contacts: any[], source: string) => {
        if (!contacts?.length) return;

        if (!lidMaps.has(sessionId)) lidMaps.set(sessionId, new Map());
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
          await this.saveLidMapToDB(sessionId);
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
      // Release lock on any initialization failure
      connectingMap.delete(sessionId);
      console.error('Error initializing socket:', error);
      throw error;
    }
  }


  // ── Handle incoming WhatsApp message ─────────────────────────
  async handleIncomingMessage(
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

      // ── LID resolution ───────────────────────────────────────
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

      // ── Contact matching ─────────────────────────────────────
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

      // ── Handle TEXT ──────────────────────────────────────────
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
          timestamp: new Date((message.messageTimestamp as number) * 1000),
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

      // ── Handle VOICE ─────────────────────────────────────────
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
          timestamp: new Date((message.messageTimestamp as number) * 1000),
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
            ...(sock && { reuploadRequest: sock.updateMediaMessage }),
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
            audioBuffer: buffer.toString('base64'),
          });

          console.log(`📬 [QUEUE] Voice note queued for transcription`);

        } catch (error) {
          console.error('❌ [VOICE] Error downloading voice note:', error);
          await Message.findByIdAndUpdate(savedMessage._id, {
            status: MessageStatus.FAILED,
            originalContent: 'Voice note (download failed)',
          });
        }
      }

      console.log(`──────────────────────────────────────────\n`);

    } catch (error) {
      console.error('❌ [MSG] Error handling incoming message:', error);
    }
  }


  // ── Check status + queue AI reply ────────────────────────────
  async checkAndQueueReply(
    userId: string,
    contactId: any,
    messageId: string,
    messageText: string,
    messageType: 'text' | 'voice'
  ): Promise<void> {
    console.log(`\n🔎 [REPLY] Running reply checks...`);

    // Gate 1: Is student away?
    const studentStatus = await StudentStatus.findOne({ userId });
    console.log(`🎓 [REPLY] Student status: ${studentStatus ? `mode="${studentStatus.mode}"` : 'NOT FOUND'}`);

    if (!studentStatus || studentStatus.mode === 'available') {
      console.log(`⏭️ [REPLY] BLOCKED — student is available`);
      return;
    }

    console.log(`✅ [REPLY] Gate 1 passed — student is away`);

    // Gate 2: Does personality profile exist WITH a knowledge base?
    // knowledgeBase (Step 2) is REQUIRED. systemPrompt (Step 3) is optional.
    const profile = await PersonalityProfile.findOne({ userId, contactId });
    console.log(`🧠 [REPLY] Profile: ${profile ? `found (id: ${profile._id})` : 'NOT FOUND'}`);

    if (!profile) {
      console.log(`⏭️ [REPLY] BLOCKED — no personality profile for this contact`);
      return;
    }

    if (!(profile as any).knowledgeBase?.trim()) {
      console.log(`⏭️ [REPLY] BLOCKED — knowledge base is empty (Step 2 not completed)`);
      return;
    }

    console.log(`✅ [REPLY] Gate 2 passed — knowledge base present`);
    if (profile.systemPrompt?.trim()) {
      console.log(`✅ [REPLY] Style summary also present (Step 3 was completed)`);
    } else {
      console.log(`ℹ️  [REPLY] No style summary — will reply using knowledge base only (Step 3 skipped)`);
    }

    const job = await replyQueue.add('generate-reply', {
      userId,
      contactId: contactId.toString(),
      messageId,
      messageText,
      messageType,
    });

    console.log(`🚀 [QUEUE] Added to replyQueue — job id: ${job.id}`);
    console.log(`💬 [QUEUE] Text: "${messageText}"`);
  }


  // ── Check if message should be processed (voice notes) ───────
  async shouldProcessMessage(userId: string, contactId: any): Promise<boolean> {
    const studentStatus = await StudentStatus.findOne({ userId });

    if (!studentStatus || studentStatus.mode === 'available') {
      console.log(`ℹ️ [VOICE] Student is available — saving but not processing`);
      return false;
    }

    const profile = await PersonalityProfile.findOne({ userId, contactId });

    // Gate on knowledgeBase (same as checkAndQueueReply for consistency)
    if (!profile || !(profile as any).knowledgeBase?.trim()) {
      console.log(`⚠️ [VOICE] No personality profile / knowledge base — saving but not processing`);
      return false;
    }

    return true;
  }
}


export default new SocketManager();