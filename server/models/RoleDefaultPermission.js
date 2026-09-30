const mongoose = require('mongoose');

const actionsSchema = new mongoose.Schema(
  {
    view: { type: Boolean, default: false },
    create: { type: Boolean, default: false },
    edit: { type: Boolean, default: false },
    delete: { type: Boolean, default: false },
    export: { type: Boolean, default: false },
    approve: { type: Boolean, default: false }
  },
  { _id: false }
);

const roleDefaultPermissionSchema = new mongoose.Schema(
  {
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role',
      required: [true, 'Role reference is required']
    },
    module: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SystemModule',
      required: [true, 'Module reference is required']
    },
    actions: {
      type: actionsSchema,
      default: () => ({})
    }
  },
  { timestamps: true }
);

roleDefaultPermissionSchema.index({ role: 1, module: 1 }, { unique: true });

module.exports = mongoose.model('RoleDefaultPermission', roleDefaultPermissionSchema);
