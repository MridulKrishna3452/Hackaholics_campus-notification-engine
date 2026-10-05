import mongoose, { Schema } from 'mongoose';
import { schemaOptions } from '../schema-default.options';
import { FocusSessionDBModel } from './focus-session.entity';

const focusSessionSchema = new Schema<FocusSessionDBModel>(
  {
    _environmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Environment',
      required: true,
    },
    _organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    _subscriberId: {
      type: Schema.Types.ObjectId,
      ref: 'Subscriber',
      required: true,
    },
    startedAt: {
      type: Schema.Types.Date,
      required: true,
    },
    endsAt: {
      type: Schema.Types.Date,
      required: true,
    },
    endedAt: Schema.Types.Date,
    open: Schema.Types.Boolean,
  },
  schemaOptions
);

// At most one open session per subscriber. `$exists:false` is not allowed in partial indexes, hence the `open: true` flag.
focusSessionSchema.index(
  { _environmentId: 1, _subscriberId: 1 },
  { unique: true, partialFilterExpression: { open: true } }
);

// "latest session of this subscriber" lookups
focusSessionSchema.index({ _environmentId: 1, _organizationId: 1, _subscriberId: 1, startedAt: -1 });

export const FocusSession =
  (mongoose.models.FocusSession as mongoose.Model<FocusSessionDBModel>) ||
  mongoose.model<FocusSessionDBModel>('FocusSession', focusSessionSchema);
