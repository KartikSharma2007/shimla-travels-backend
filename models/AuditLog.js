const mongoose = require('mongoose');

/**
 * AuditLog Schema
 * Records every admin action for accountability and review
 */
const auditLogSchema = new mongoose.Schema({
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    adminEmail: { type: String, required: true },
    action: { type: String, required: true }, // e.g. BAN_USER, CANCEL_BOOKING
    targetType: { type: String },                 // User, Booking, Review, Hotel, Package
    targetId: { type: String },
    details: { type: mongoose.Schema.Types.Mixed }, // any extra info
    ip: { type: String },
}, { timestamps: true });

auditLogSchema.index({ adminId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);

