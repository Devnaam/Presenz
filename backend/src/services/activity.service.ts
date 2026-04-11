import { ActivityLog } from '../models/ActivityLog';
import type { ActivityEventType } from '../models/ActivityLog';

interface LogParams {
  userId: string;
  type: ActivityEventType;
  title: string;
  description: string;
  metadata?: Record<string, any>;
}

class ActivityService {
  // Never throws — activity logging is non-critical
  async log(params: LogParams): Promise<void> {
    try {
      await ActivityLog.create({
        userId:      params.userId,
        type:        params.type,
        title:       params.title,
        description: params.description,
        metadata:    params.metadata || {},
      });
    } catch (error) {
      console.error('❌ [ACTIVITY] Failed to log event:', params.type, error);
    }
  }
}

export default new ActivityService();