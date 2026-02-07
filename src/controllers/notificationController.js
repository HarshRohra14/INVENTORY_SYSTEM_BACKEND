// --- START FIX: Import Prisma types ---
const { PrismaClient, NotificationType } = require('@prisma/client'); // Import NotificationType enum
// --- END FIX ---
const Joi = require('joi');
const { sendEmailNotification, sendWhatsAppNotification } = require('../services/notificationService');
const prisma = require('../lib/prisma'); // Use the shared Prisma client


/**
 * Get current user's SYSTEM notifications (for frontend display)
 * GET /api/notifications/me
 */
const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    // --- START FIX: Use Enum directly in filter ---
    // Define the list of enum members to include
    const systemNotificationEnumTypes = [
      // NotificationType.SYSTEM, // <-- REMOVED: This likely doesn't exist in your enum
      NotificationType.SYSTEM_ALERT,
      NotificationType.ORDER_CREATED,
      NotificationType.ORDER_CONFIRM_PENDING,
      NotificationType.ORDER_CONFIRMED,
      NotificationType.ORDER_ISSUE_RAISED,
      NotificationType.ORDER_MANAGER_REPLY,
      NotificationType.ORDER_UNDER_PACKAGING,
      NotificationType.ORDER_ARRANGING,
      NotificationType.ORDER_ARRANGED,
      NotificationType.ORDER_SENT_FOR_PACKAGING,
      NotificationType.ORDER_IN_TRANSIT,
      NotificationType.ORDER_RECEIVED,
      NotificationType.ORDER_CLOSED,
      NotificationType.STOCK_LOW
      // Add other enum members as needed
    ];

    // Fetch only notifications matching the defined system enum types
    const notifications = await prisma.notification.findMany({
      where: {
        userId,
        type: { in: systemNotificationEnumTypes } // Use the enum array
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Count only unread notifications matching the defined system enum types
    const unreadCount = await prisma.notification.count({
      where: {
        userId,
        isRead: false,
        type: { in: systemNotificationEnumTypes } // Use the enum array here too
      }
    });
    // --- END FIX ---

    res.json({ success: true, data: { notifications, unreadCount } });
  } catch (error) {
    console.error('Get my notifications error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
};

/**
 * Mark notifications as read
 * POST /api/notifications/mark-read
 * { ids?: string[], markAll?: boolean }
 */
const markNotificationsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    // --- START FIX: Define enum types for filtering ---
    const systemNotificationEnumTypes = [
      // NotificationType.SYSTEM, // <-- REMOVED: This likely doesn't exist in your enum
      NotificationType.SYSTEM_ALERT, NotificationType.ORDER_CREATED,
      NotificationType.ORDER_CONFIRM_PENDING, NotificationType.ORDER_CONFIRMED, NotificationType.ORDER_ISSUE_RAISED,
      NotificationType.ORDER_MANAGER_REPLY, NotificationType.ORDER_UNDER_PACKAGING, NotificationType.ORDER_ARRANGING, NotificationType.ORDER_ARRANGED, NotificationType.ORDER_SENT_FOR_PACKAGING, NotificationType.ORDER_IN_TRANSIT,
      NotificationType.ORDER_RECEIVED, NotificationType.ORDER_CLOSED, NotificationType.STOCK_LOW
      // Add other enum members shown in UI
    ];
    // --- END FIX ---

    const schema = Joi.object({
      ids: Joi.array().items(Joi.string()).optional(), // Keep validating IDs as strings
      markAll: Joi.boolean().optional(),
    });
    const { error, value } = schema.validate(req.body || {});
    if (error) {
      return res.status(400).json({ success: false, message: 'Validation error', errors: error.details.map(d => d.message) });
    }

    const { ids, markAll } = value;

    // --- START FIX: Use Enum in where clause ---
    // Base where clause includes user and relevant enum types
    const baseWhere = {
        userId,
        type: { in: systemNotificationEnumTypes } // Use the enum array
    };

    // Adjust where clause based on markAll or specific ids
    const where = markAll
      ? { ...baseWhere, isRead: false } // Mark all unread system notifications
      : { ...baseWhere, id: { in: ids || [] } }; // Mark specific system notifications by ID
    // --- END FIX ---

    const result = await prisma.notification.updateMany({
        where,
        data: { isRead: true, readAt: new Date() }
    });

    res.json({ success: true, data: { updatedCount: result.count } });
  } catch (error) {
    console.error('Mark notifications read error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark notifications as read' });
  }
};


/**
 * Broadcast notification to BRANCH_USERs, selecting specific users or by branches
 * POST /api/notifications/broadcast
 * Body: { subject: string, message: string, branchIds?: string[], userIds?: string[] }
 */
const broadcastNotifications = async (req, res) => {
  try {
    const schema = Joi.object({
      subject: Joi.string().min(3).max(5000).required(),
      message: Joi.string().min(1).max(50000).required(),
      branchIds: Joi.array().items(Joi.string()).min(1).optional(),
      userIds: Joi.array().items(Joi.string()).min(1).optional(),
    });
    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: 'Validation error', errors: error.details.map(d => d.message) });
    }

    const { subject, message, branchIds, userIds } = value;

    if ((!branchIds || branchIds.length === 0) && (!userIds || userIds.length === 0)) {
      return res.status(400).json({ success: false, message: 'Provide at least one branchId or userId' });
    }

    // Resolve target users
    const users = await prisma.user.findMany({
      where: userIds && userIds.length > 0
        ? { id: { in: userIds }, role: 'BRANCH_USER', isActive: true }
        : { role: 'BRANCH_USER', branchId: { in: branchIds || [] }, isActive: true },
      select: { id: true, email: true, firstName: true, lastName: true, phoneNumber: true },
    });

    if (users.length === 0) {
      return res.json({ success: true, message: 'No users found for the selected target', data: { createdCount: 0 } });
    }

    // Conditional Logic for Mock vs Production
    const isMockModeEmail = !process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS;
    const isMockModeWhatsApp = !process.env.SMARTWHAP_API_URL || !process.env.SMARTWHAP_API_KEY || !process.env.SMARTWHAP_SENDER;

    const now = new Date();
    const systemNotificationsToCreate = [];
    const emailsToSend = [];
    const whatsAppsToSend = [];

    // --- START FIX: Use Enum for type ---
    const systemAlertType = NotificationType.SYSTEM_ALERT; // Use the enum member
    // --- END FIX ---


    for (const u of users) {
      // 1. Always create the SYSTEM notification record for the UI list/Bell Icon
      systemNotificationsToCreate.push({
        type: systemAlertType, // Use the enum variable
        title: subject,
        message: message,
        userId: u.id,
        isRead: false,
        isEmail: !isMockModeEmail,
        isWhatsApp: !isMockModeWhatsApp,
        createdAt: now
      });

      // 2. Handle Email: Log if mock, prepare to send if production
      // Preserve formatting: escape HTML and wrap in <pre> tag to preserve all spaces and line breaks
      const escapedMessage = message
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <pre style="font-family: Arial, sans-serif; white-space: pre-wrap; word-wrap: break-word; margin: 0; background-color: #f9f9f9; padding: 15px; border-radius: 5px;">${escapedMessage}</pre>
        </div>
      `;
      const emailData = { to: u.email, subject: subject, html: htmlContent };
      if (isMockModeEmail) {
        console.log('=============== MOCK BROADCAST EMAIL ===============');
        console.log(`TO: ${emailData.to}`);
        console.log(`SUBJECT: ${emailData.subject}`);
        console.log(`MESSAGE (HTML): ${emailData.html.substring(0, 100)}...`);
        console.log('====================================================');
      } else {
        emailsToSend.push(emailData);
      }

      // 3. Handle WhatsApp: Log if mock, prepare to send if production
      const userPhoneNumber = u.phoneNumber || process.env.SMARTWHAP_TEST_NUMBER; // Prefer real phone number
      const whatsAppData = { to: userPhoneNumber, message: `${subject}\n\n${message}` };

      if (!whatsAppData.to) {
        console.warn(`Skipping WhatsApp for user ${u.email}: No phone number found.`);
      } else if (isMockModeWhatsApp) {
        console.log('============= MOCK BROADCAST WHATSAPP =============');
        console.log(`TO: ${whatsAppData.to}`);
        console.log(`MESSAGE: ${whatsAppData.message}`);
        console.log('===================================================');
      } else {
        whatsAppsToSend.push(whatsAppData);
      }
    }

    // Save *only* the SYSTEM_ALERT records to the DB
    const createResult = await prisma.notification.createMany({
       data: systemNotificationsToCreate
    });

    // Fire-and-forget actual sends (only happens in production mode)
    if (!isMockModeEmail || !isMockModeWhatsApp) {
      (async () => {
         console.log(`Processing broadcast: ${emailsToSend.length} emails, ${whatsAppsToSend.length} WhatsApp messages.`);
         try {
           // Send emails if not in mock mode
           if (!isMockModeEmail && emailsToSend.length > 0) {
             const emailResults = await Promise.allSettled(
               emailsToSend.map(e => sendEmailNotification(e.to, e.subject, e.html))
             );
             emailResults.forEach((result, index) => {
               if (result.status === 'rejected') {
                 console.error(`Failed to send email to ${emailsToSend[index].to}:`, result.reason);
               }
             });
           }

           // Send WhatsApp messages if not in mock mode
           if (!isMockModeWhatsApp && whatsAppsToSend.length > 0) {
             const whatsappResults = await Promise.allSettled(
               whatsAppsToSend.map(w => sendWhatsAppNotification(w.to, w.message))
             );
             whatsappResults.forEach((result, index) => {
               if (result.status === 'rejected') {
                 console.error(`Failed to send WhatsApp to ${whatsAppsToSend[index].to}:`, result.reason);
               }
             });
           }
           console.log('Finished processing broadcast sends.');
         } catch (err) {
           console.error('Broadcast send error (non-blocking):', err);
         }
       })();
    }

    res.json({
      success: true,
      message: `Broadcast processed for ${users.length} users.`,
      data: { createdDbRecords: createResult.count }
    });

  } catch (error) {
    console.error('Broadcast notifications error:', error);
    res.status(500).json({ success: false, message: 'Failed to broadcast notifications' });
  }
};


/**
 * Get BRANCH_USER users in given branches (manager/admin only)
 * GET /api/notifications/branch-users?branchIds=a&branchIds=b
 */
const getBranchUsers = async (req, res) => {
  try {
    // Ensure query param is treated as an array
    const branchIdsQuery = req.query.branchIds;
    const branchIds = Array.isArray(branchIdsQuery) ? branchIdsQuery : (branchIdsQuery ? [branchIdsQuery] : []);

    if (branchIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // Validate branchIds are strings
     const validBranchIds = branchIds.filter(id => typeof id === 'string');
     if(validBranchIds.length !== branchIds.length){
        return res.status(400).json({ success: false, message: 'Invalid branchIds provided.' });
     }


    const users = await prisma.user.findMany({
      where: {
          role: 'BRANCH_USER',
          isActive: true,
          branchId: { in: validBranchIds }
      },
      select: { id: true, firstName: true, lastName: true, email: true, branchId: true, phoneNumber: true }
    });
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('Get branch users error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch branch users' });
  }
};

// Ensure all controller functions are exported
module.exports = {
  getMyNotifications,
  markNotificationsRead,
  broadcastNotifications,
  getBranchUsers,
};

