import { AuthenticationCreds, AuthenticationState, initAuthCreds, BufferJSON } from '@whiskeysockets/baileys';
import { WhatsAppSession } from '../models';
import { proto } from '@whiskeysockets/baileys';


/**
 * Custom MongoDB-based auth state handler for Baileys
 * Stores session credentials in MongoDB instead of files
 */
export const useMongoDBAuthState = async (
  sessionId: string
): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> => {

  let session = await WhatsAppSession.findOne({ sessionId });

  let creds: AuthenticationCreds;
  let keys: any = {};

  if (session?.authState) {
    // ✅ Use BufferJSON.reviver to properly restore Buffer objects
    const restored = JSON.parse(
      JSON.stringify(session.authState),
      BufferJSON.reviver
    );
    creds = restored.creds;
    keys = restored.keys || {};
  } else {
    creds = initAuthCreds();
    keys = {};
  }

  const saveCreds = async () => {
    try {
      // ✅ Use BufferJSON.replacer to properly serialize Buffer objects
      const authState = JSON.parse(
        JSON.stringify({ creds, keys }, BufferJSON.replacer)
      );

      await WhatsAppSession.findOneAndUpdate(
        { sessionId },
        { authState },
        { upsert: true }
      );
    } catch (error) {
      console.error('Error saving auth state:', error);
    }
  };

  return {
    state: {
      creds,
      keys: {
        get: (type: any, ids: any) => {
          const data: any = {};
          for (const id of ids) {
            let value = keys[`${type}-${id}`];
            if (value) {
              if (type === 'app-state-sync-key') {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[id] = value;
            }
          }
          return data;
        },
        // ✅ FIX: Use .catch() to handle floating promise from saveCreds()
        set: (data: any) => {
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const key = `${category}-${id}`;
              if (value) {
                keys[key] = value;
              } else {
                delete keys[key];
              }
            }
          }
          saveCreds().catch(err => console.error('❌ Error in keys.set saveCreds:', err));
        }
      }
    },
    saveCreds
  };
};