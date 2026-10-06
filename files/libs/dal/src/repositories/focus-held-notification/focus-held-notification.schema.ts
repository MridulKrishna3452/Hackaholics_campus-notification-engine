import mongoose, { Schema } from 'mongoose';
import { schemaOptions } from '../schema-default.options';
import { FocusHeldNotificationDBModel } from './focus-held-notification.entity';

const RETENTION_SECONDS = 60 * 60 * 24 * 30; // 30 days — placeholder, see open question Q5

const focusHeldNotificationSchema = new Schema<FocusHeldNotificationDBModel>(
  {
    _environmentId: { type: Schema.Types.ObjectId, ref: 'Environment', required: true },
    _organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    _subscriberId: { type: Schema.Types.ObjectId, ref: 'Subscriber', required: true },
    _focusSessionId: { type: Schema.Types.ObjectId, ref: 'FocusSession', required: true },
    _notificationId: { type: Schema.Types.ObjectId, ref: 'Notification', required: true },
    transactionId: { type: Schema.Types.String, required: true },
    workflowIdentifier: { type: Schema.Types.String, required: true },
    entityKey: Schema.Types.String,
    stepTypes: { type: [Schema.Types.String], default: [] },
    heldAt: { type: Schema.Types.Date, required: true },
  },
  schemaOptions
);

// Dedup: a notification is recorded once per focus session, regardless of how many channel steps were held.
focusHeldNotificationSchema.index({ _focusSessionId: 1, _notificationId: 1 }, { unique: true });

// Summary lookup
focusHeldNotificationSchema.index({ _environmentId: 1, _subscriberId: 1, _focusSessionId: 1, heldAt: 1 });

focusHeldNotificationSchema.index({ heldAt: 1 }, { expireAfterSeconds: RETENTION_SECONDS });

export const FocusHeldNotification =
  (mongoose.models.FocusHeldNotification as mongoose.Model<FocusHeldNotificationDBModel>) ||
  mongoose.model<FocusHeldNotificationDBModel>('FocusHeldNotification', focusHeldNotificationSchema);
