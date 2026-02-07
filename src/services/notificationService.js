const nodemailer = require('nodemailer');
const axios = require('axios');
const prisma = require('../lib/prisma'); // Reuse the shared Prisma client to avoid creating multiple connections

// Cached SMTP transporter and verification flag
let transporter = null;
let smtpVerified = false;

const getSmtpTransporter = async () => {
  if (!process.env.SMTP_HOST) return null; // no SMTP configured
  if (transporter && smtpVerified) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  try {
    // verify connection & authentication; if this fails, we surface it and avoid spamming with repeated attempts
    await transporter.verify();
    smtpVerified = true;
    return transporter;
  } catch (err) {
    console.error('SMTP verification failed:', err);
    transporter = null; // reset so subsequent calls can retry after config fixes
    smtpVerified = false;
    throw err;
  }
};

/**
 * Notification Service
 * Handles email and WhatsApp notifications for order status changes
 */

/**
 * Send email notification
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} htmlContent - HTML email content
 * @returns {Object} Result of the email sending operation
 */
const sendEmailNotification = async (to, subject, htmlContent) => {
  try {
    console.log(`🔍 [EMAIL] sendEmailNotification called with to=${to}, subject=${subject}`);
    if (!process.env.SMTP_HOST) {
      console.warn('SMTP not configured. Skipping real email send.');
      return { success: true, messageId: `email_mock_${Date.now()}`, message: 'Email mocked' };
    }

    try {
      const transporter = await getSmtpTransporter();
      if (!transporter) {
        console.warn('SMTP not configured or verification failed. Skipping send.');
        return { success: false, messageId: null, message: 'SMTP not configured or verification failed' };
      }

      console.log(`🔍 [EMAIL] About to send mail via nodemailer...`);
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject,
        html: htmlContent,
      });
      console.log(`🔍 [EMAIL] Mail sent successfully. MessageId:`, info.messageId);

      return { success: true, messageId: info.messageId };
    } catch (err) {
      // If Gmail returns an auth error (535) provide helpful guidance
      if (err && err.responseCode === 535) {
        console.error('Gmail authentication failed. If you are using a Google account, please use an App Password (recommended) or configure OAuth2. See: https://support.google.com/mail/?p=BadCredentials');
      }

      console.error('❌ Email notification failed:', err);
      return {
        success: false,
        message: 'Failed to send email notification',
        error: err && err.message ? err.message : String(err)
      };
    }
  } catch (error) {
    console.error('❌ Email notification failed:', error);
    return {
      success: false,
      message: 'Failed to send email notification',
      error: error.message
    };
  }
};

/**
 * Send WhatsApp notification
 * @param {string} phoneNumber - Recipient phone number (with country code)
 * @param {string} message - WhatsApp message content
 * @returns {Object} Result of the WhatsApp sending operation
 */
const sendWhatsAppNotification = async (phoneNumber, message) => {
  try {
    const apiUrl = process.env.SMARTWHAP_API_URL;
    const apiKey = process.env.SMARTWHAP_API_KEY;
    const sender = process.env.SMARTWHAP_SENDER;

    if (!apiUrl || !apiKey || !sender) {
      console.warn('SmartWhap not configured. Skipping real WhatsApp send.');
      return { success: true, messageId: `whatsapp_mock_${Date.now()}`, message: 'WhatsApp mocked' };
    }

    const to = phoneNumber || process.env.SMARTWHAP_TEST_NUMBER;
    if (!to) {
      console.warn('No WhatsApp recipient. Skipping send.');
      return { success: false, message: 'Missing WhatsApp number' };
    }

    const resp = await axios.post(`${apiUrl}/messages/text`,
      {
        to,
        from: sender,
        message,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    const ok = resp.status >= 200 && resp.status < 300;
    return { success: ok, messageId: resp.data?.id || `smartwhap_${Date.now()}` };
  } catch (error) {
    console.error('❌ WhatsApp notification failed:', error);
    return {
      success: false,
      message: 'Failed to send WhatsApp notification',
      error: error.message
    };
  }
};

/**
 * Send order confirm pending notification
 * @param {Object} order - Order object with all details
 * @returns {Object} Result of the notification operation
 */
const sendOrderConfirmPendingNotification = async (order, manager) => {
  try {
    console.log(`📬 Sending order confirm pending notification for order ${order.orderNumber}`);

    const companyName = 'Mystery Rooms';
    const appUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

    // ===== EMAIL FOR BRANCH USER (REQUESTER) =====
    const branchUserSubject = `Order Approved - Confirmation Required [Order #${order.orderNumber}]`;
    const branchUserHtmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
        <div style="background-color: #f59e0b; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">⏳ Order Approved & Awaiting Your Confirmation</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px;">Manager has approved - Your action needed</p>
        </div>
        
        <div style="padding: 30px; background-color: white; margin: 20px;">
          <p style="color: #111827; font-size: 16px;">Hi ${order.requester.firstName},</p>
          
          <p style="color: #374151; line-height: 1.6;">
            Great news! Your order has been <strong>approved by the manager</strong> and is now waiting for your confirmation to proceed with dispatch.
          </p>

          <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <table style="width: 100%; color: #374151;">
              <tr style="border-bottom: 1px solid #fcd34d;">
                <td style="padding: 12px 0; font-weight: bold; width: 45%;">Order ID:</td>
                <td style="padding: 12px 0; color: #f59e0b; font-weight: bold; font-size: 16px;">${order.orderNumber}</td>
              </tr>
              <tr style="border-bottom: 1px solid #fcd34d;">
                <td style="padding: 12px 0; font-weight: bold;">Branch:</td>
                <td style="padding: 12px 0;">${order.branch.name}</td>
              </tr>
              <tr style="border-bottom: 1px solid #fcd34d;">
                <td style="padding: 12px 0; font-weight: bold;">Approved On:</td>
                <td style="padding: 12px 0;">${new Date(order.approvedAt).toLocaleString('en-IN')}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; font-weight: bold;">Status:</td>
                <td style="padding: 12px 0;">
                  <span style="background-color: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold;">Awaiting Confirmation</span>
                </td>
              </tr>
            </table>
          </div>

          <h3 style="color: #111827; margin-top: 30px;">📦 Order Summary</h3>
          <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 15px; margin: 15px 0; border-radius: 4px;">
            <p style="color: #0c4a6e; margin: 0;"><strong>${order.totalItems}</strong> items have been approved for dispatch</p>
          </div>

          <div style="background-color: #fef3c7; border-left: 4px solid #eab308; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #713f12; margin-top: 0;">⚠️ Action Required</h3>
            <p style="color: #713f12; margin: 10px 0; line-height: 1.6;">
              Please review the approved quantities above. They may have been increased by the manager based on availability or requirements.
            </p>
            <ul style="color: #713f12; margin: 10px 0; padding-left: 20px;">
              <li style="margin: 8px 0;"><strong>✅ Confirm Order:</strong> Accept the approved quantities and finalize for dispatch</li>
              <li style="margin: 8px 0;"><strong>❌ Raise Issue:</strong> If quantities don't meet your needs, raise an issue for manager review</li>
            </ul>
          </div>

          <p style="color: #6b7280; margin-top: 30px; line-height: 1.6;">
            Thank you for using our inventory management system. We appreciate your prompt confirmation!
          </p>

          <div style="background-color: #f3f4f6; padding: 15px; margin-top: 30px; border-radius: 4px; text-align: center;">
            <p style="color: #6b7280; margin: 0; font-size: 11px;">
              <strong>${companyName}</strong><br>
              Inventory & Procurement System<br>
              <strong>Order Reference:</strong> ${order.id}
            </p>
          </div>
        </div>

        <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">
            This is an automated notification from your inventory management system.<br>
            Please use the system to confirm or raise issues regarding this order.
          </p>
        </div>
      </div>
    `;

    // ===== EMAIL FOR MANAGER =====
    const managerSubject = `Order Approved & Awaiting Branch Confirmation [Order #${order.orderNumber}]`;
    const managerHtmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
        <div style="background-color: #f59e0b; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">⏳ Approval Pending Branch Confirmation</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px;">Awaiting branch user's action on approved order</p>
        </div>
        
        <div style="padding: 30px; background-color: white; margin: 20px;">
          <p style="color: #111827; font-size: 16px;">Hi ${manager.firstName},</p>
          
          <p style="color: #374151; line-height: 1.6;">
            You have successfully <strong>approved order ${order.orderNumber}</strong>. The branch user has been notified and the order is now awaiting their confirmation to proceed with dispatch.
          </p>

          <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <table style="width: 100%; color: #374151;">
              <tr style="border-bottom: 1px solid #fcd34d;">
                <td style="padding: 12px 0; font-weight: bold; width: 45%;">Order ID:</td>
                <td style="padding: 12px 0; color: #f59e0b; font-weight: bold; font-size: 16px;">${order.orderNumber}</td>
              </tr>
              <tr style="border-bottom: 1px solid #fcd34d;">
                <td style="padding: 12px 0; font-weight: bold;">Requested By:</td>
                <td style="padding: 12px 0;">${order.requester.firstName} ${order.requester.lastName}</td>
              </tr>
              <tr style="border-bottom: 1px solid #fcd34d;">
                <td style="padding: 12px 0; font-weight: bold;">Branch:</td>
                <td style="padding: 12px 0;">${order.branch.name}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; font-weight: bold;">Status:</td>
                <td style="padding: 12px 0;">
                  <span style="background-color: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold;">Awaiting Confirmation</span>
                </td>
              </tr>
            </table>
          </div>

          <h3 style="color: #111827; margin-top: 30px;">📦 Total Items Approved</h3>
          <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 15px; margin: 15px 0; border-radius: 4px;">
            <p style="color: #0c4a6e; margin: 0;"><strong>${order.totalItems}</strong> items approved for dispatch</p>
          </div>

          <div style="background-color: #f3f4f6; border-left: 4px solid #6b7280; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #374151; margin-top: 0;">📋 What Happens Next?</h3>
            <ul style="color: #374151; margin: 10px 0; padding-left: 20px;">
              <li style="margin: 8px 0;"><strong>Branch confirms:</strong> Order moves to dispatch/packaging stage</li>
              <li style="margin: 8px 0;"><strong>Branch raises issue:</strong> Order goes back to review stage for adjustment</li>
            </ul>
            <p style="color: #374151; margin: 10px 0; font-weight: 600;">
              You will receive a notification once the branch user confirms or raises any issues.
            </p>
          </div>

          <p style="color: #6b7280; margin-top: 30px; line-height: 1.6;">
            Thank you for managing orders efficiently!
          </p>

          <div style="background-color: #f3f4f6; padding: 15px; margin-top: 30px; border-radius: 4px; text-align: center;">
            <p style="color: #6b7280; margin: 0; font-size: 11px;">
              <strong>${companyName}</strong><br>
              Inventory & Procurement System<br>
              <strong>Order Reference:</strong> ${order.id}
            </p>
          </div>
        </div>

        <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">
            This is an automated notification from your inventory management system.
          </p>
        </div>
      </div>
    `;

    // Prepare WhatsApp messages
    const branchUserWhatsAppMessage = `⏳ *Order Approved & Awaiting Confirmation*

Hi ${order.requester.firstName},

Your order has been approved by the manager! Please review and confirm.

📦 *Order Details:*
• Order ID: ${order.orderNumber}
• Branch: ${order.branch.name}
• Total Items: ${order.totalItems}

📋 *Approved Items:*
${order.orderItems.map(item => {
  const approved = item.qtyApproved || item.qtyRequested;
  return `• ${item.item.name}: ${approved} ${item.item.unit}`;
}).join('\n')}

⚠️ *Action Required:*
✅ Confirm Order - Accept and finalize
❌ Raise Issue - If quantities need adjustment

Thank you,
${companyName}`;

    const managerWhatsAppMessage = `⏳ *Order Approved & Awaiting Branch Confirmation*

Hi ${manager.firstName},

Order ${order.orderNumber} has been approved and sent to ${order.requester.firstName} for confirmation.

📦 *Order Details:*
• Order ID: ${order.orderNumber}
• Requester: ${order.requester.firstName} ${order.requester.lastName}
• Branch: ${order.branch.name}
• Total Items: ${order.totalItems}

⏳ Awaiting branch user's confirmation or issue raised.

${companyName}`;

    // Send all notifications in parallel
    const [branchEmailResult, managerEmailResult, branchWhatsAppResult, managerWhatsAppResult] = await Promise.all([
      sendEmailNotification(order.requester.email, branchUserSubject, branchUserHtmlContent),
      manager && manager.email ? sendEmailNotification(manager.email, managerSubject, managerHtmlContent) : Promise.resolve({ success: false }),
      order.requester?.phoneNumber ? sendWhatsAppNotification(order.requester.phoneNumber, branchUserWhatsAppMessage) : Promise.resolve({ success: false }),
      manager && manager.phoneNumber ? sendWhatsAppNotification(manager.phoneNumber, managerWhatsAppMessage) : Promise.resolve({ success: false })
    ]);

    // Update notification records
    await prisma.notification.updateMany({
      where: {
        orderId: order.id,
        type: 'ORDER_CONFIRM_PENDING'
      },
      data: {
        isEmail: branchEmailResult.success || managerEmailResult.success,
        isWhatsApp: branchWhatsAppResult.success || managerWhatsAppResult.success
      }
    });

    return {
      success: true,
      message: 'Order confirmation notifications sent to both parties',
      branchEmail: branchEmailResult,
      managerEmail: managerEmailResult,
      branchWhatsApp: branchWhatsAppResult,
      managerWhatsApp: managerWhatsAppResult
    };

  } catch (error) {
    console.error('❌ Order confirmation pending notification failed:', error);
    return {
      success: false,
      message: 'Failed to send order confirmation pending notifications',
      error: error.message
    };
  }
};

/**
 * Send order dispatch notification
 * @param {Object} order - Order object with tracking details
 * @returns {Object} Result of the notification operation
 */
const sendOrderDispatchNotification = async (order) => {
  try {
    console.log(`📬 Sending order dispatch notification for order ${order.orderNumber}`);

    // Prepare email content
    const emailSubject = `Order Dispatched: ${order.orderNumber}`;
    const emailHtmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">🚚 Order Dispatched</h2>
        <p>Dear ${order.requester.firstName} ${order.requester.lastName},</p>
        
        <p>Your order <strong>${order.orderNumber}</strong> has been dispatched and is on its way!</p>
        
        <h3>Tracking Information:</h3>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Tracking ID:</strong> ${order.tracking?.trackingId || 'N/A'}</p>
          ${order.tracking?.courierLink ? `<p><strong>Track Online:</strong> <a href="${order.tracking.courierLink}" style="color: #2563eb;">${order.tracking.courierLink}</a></p>` : ''}
        </div>

        <h3>Order Details:</h3>
        <ul>
          <li><strong>Order Number:</strong> ${order.orderNumber}</li>
          <li><strong>Branch:</strong> ${order.branch.name}</li>
          <li><strong>Total Items:</strong> ${order.totalItems}</li>
          <li><strong>Order Value:</strong> ₹${order.totalValue ? order.totalValue.toFixed(2) : '0.00'}</li>
          <li><strong>Dispatched On:</strong> ${new Date(order.dispatchedAt).toLocaleString()}</li>
        </ul>

        <p><strong>${order.totalItems}</strong> items have been dispatched to your branch.</p>

        <p>You can track your order using the tracking ID provided above.</p>
        
        <p>Thank you for using our inventory management system!</p>
        
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px;">
          This is an automated notification. Please do not reply to this email.
        </p>
      </div>
    `;

    // Prepare WhatsApp message
    const whatsAppMessage = `🚚 *Order Dispatched: ${order.orderNumber}*

Dear ${order.requester.firstName},

Your order has been dispatched and is on its way!

📦 *Tracking Information:*
• Tracking ID: ${order.tracking?.trackingId || 'N/A'}
${order.tracking?.courierLink ? `• Track Online: ${order.tracking.courierLink}` : ''}

📋 *Order Details:*
• Order: ${order.orderNumber}
• Branch: ${order.branch.name}
• Items: ${order.totalItems}
• Value: ₹${order.totalValue ? order.totalValue.toFixed(2) : '0.00'}

You can track your order using the tracking ID above.

Thank you! 🚀`;

    // Send notifications
    const [emailResult, whatsAppResult] = await Promise.all([
      sendEmailNotification(order.requester.email, emailSubject, emailHtmlContent),
      sendWhatsAppNotification(order.requester?.phoneNumber || process.env.SMARTWHAP_TEST_NUMBER, whatsAppMessage) // use requester phoneNumber or fallback
    ]);

    // Update notification records
    await prisma.notification.updateMany({
      where: {
        orderId: order.id,
        type: 'ORDER_DISPATCHED'
      },
      data: {
        isEmail: emailResult.success,
        isWhatsApp: whatsAppResult.success
      }
    });

    return {
      success: true,
      message: 'Order dispatch notifications sent',
      emailResult,
      whatsAppResult
    };

  } catch (error) {
    console.error('❌ Order dispatch notification failed:', error);
    return {
      success: false,
      message: 'Failed to send order dispatch notifications',
      error: error.message
    };
  }
};

/**
 * Send system notification
 * @param {string} type - Notification type
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} userId - Optional user ID
 * @param {string} orderId - Optional order ID
 * @returns {Object} Result of the notification operation
 */
const sendSystemNotification = async (type, title, message, userId = null, orderId = null) => {
  try {
    console.log(`📬 Sending system notification: ${title}`);

    // Create notification record
    const notification = await prisma.notification.create({
      data: {
        type,
        title,
        message,
        userId,
        orderId,
        isRead: false,
        isEmail: false,
        isWhatsApp: false
      }
    });

    return {
      success: true,
      message: 'System notification created',
      notification
    };

  } catch (error) {
    console.error('❌ System notification failed:', error);
    return {
      success: false,
      message: 'Failed to create system notification',
      error: error.message
    };
  }
};

/**
 * Notify multiple users: create DB notifications, emit realtime events, and send emails.
 * @param {Array<string>} userIds
 * @param {string} orderId
 * @param {string} type
 * @param {string} title
 * @param {string} message
 * @returns {Object}
 */
const notifyUsers = async (userIds = [], orderId = null, type = 'SYSTEM', title = '', message = '') => {
  try {
    if (!Array.isArray(userIds) || userIds.length === 0) return { success: true, message: 'No users to notify' };

    // Deduplicate and remove falsy ids
    const ids = Array.from(new Set(userIds.filter(Boolean)));

    // Fetch user emails for optional email sending and realtime payload
    const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true, firstName: true, lastName: true, phoneNumber: true } });

    // Create notifications in DB (one-by-one to populate relations reliably)
    const created = [];
    for (const u of users) {
      const n = await prisma.notification.create({
        data: {
          type,
          title: title || (type || 'SYSTEM'),
          message,
          userId: u.id,
          orderId: orderId || null,
          isRead: false
        }
      });
      created.push(n);

      // Prepare realtime emit (placeholder for Pusher / Socket.io)
      const realtimePayload = {
        notification: {
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          orderId: n.orderId,
          createdAt: n.createdAt
        }
      };

      try {
        // If Pusher config present, trigger an event. If not, this is a no-op.
        if (process.env.PUSHER_APP_ID && process.env.PUSHER_KEY && process.env.PUSHER_SECRET) {
          try {
            const Pusher = require('pusher');
            const p = new Pusher({
              appId: process.env.PUSHER_APP_ID,
              key: process.env.PUSHER_KEY,
              secret: process.env.PUSHER_SECRET,
              cluster: process.env.PUSHER_CLUSTER || undefined,
              useTLS: process.env.PUSHER_USE_TLS === 'true'
            });
            // channel: `private-user-{id}` event: `notification`
            p.trigger(`private-user-${u.id}`, 'notification', realtimePayload).catch(() => { });
          } catch (err) {
            // don't fail the whole operation if pusher not installed or triggers fail
            console.warn('Pusher trigger skipped or failed:', err.message);
          }
        }
      } catch (err) {
        console.warn('Realtime emit skipped:', err.message);
      }

      // Send email (non-blocking) - DISABLED
      // if (u.email) {
      //   (async () => {
      //     try {
      //       const subject = title || `Notification: ${type}`;
      //       //const html = `<p>Hi ${u.firstName || ''},</p><p>${message}</p><hr/><p>This is an automated message.</p>`;
      //       const html = `
      // <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
      //   
      //   <!-- Header -->
      //   <div style="padding: 16px 24px; background-color: #2563eb; color: #ffffff;">
      //     <h2 style="margin: 0; font-size: 20px;">${title || 'Notification'}</h2>
      //   </div>

      //   <!-- Body -->
      //   <div style="padding: 24px;">
      //     <p style="font-size: 14px; color: #111827;">
      //       Hi <strong>${u.firstName || 'there'}</strong>,
      //     </p>

      //     <div style="margin: 16px 0; padding: 16px; background-color: #f3f4f6; border-left: 4px solid #2563eb;">
      //       <p style="margin: 0; font-size: 14px; color: #374151;">
      //         ${message}
      //       </p>
      //     </div>

      //     ${orderId ? `
      //     <p style="font-size: 13px; color: #6b7280;">
      //       <strong>Related Order ID:</strong> ${orderId}
      //     </p>
      //     ` : ''}

      //     <p style="font-size: 13px; color: #374151;">
      //       Please log in to the system for more details.
      //     </p>
      //   </div>

      //   <!-- Footer -->
      //   <div style="padding: 16px 24px; border-top: 1px solid #e5e7eb; background-color: #f9fafb;">
      //     <p style="margin: 0; font-size: 12px; color: #6b7280;">
      //       This is an automated notification. Please do not reply to this email.
      //     </p>
      //   </div>

      // </div>
      // `;

      //       await sendEmailNotification(u.email, subject, html);
      //       // mark notification as emailed
      //       await prisma.notification.update({ where: { id: n.id }, data: { isEmail: true } });
      //     } catch (err) {
      //       console.error('Failed to send email for notification', n.id, err.message || err);
      //     }
      //   })();
      // }
    }

    return { success: true, message: 'Notifications created', data: created };
  } catch (error) {
    console.error('❌ notifyUsers failed:', error);
    return { success: false, message: error.message };
  }
};

/**
 * Send order confirmed notification (to manager)
 * @param {Object} order - Order object with all details
 * @returns {Object} Result of the notification operation
 */
const sendOrderConfirmedNotification = async (order, manager) => {
  try {
    console.log(`📬 Sending order confirmed notification for order ${order.orderNumber}`);

    const companyName = 'Mystery Rooms';
    const appUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

    // ===== EMAIL FOR BRANCH USER (REQUESTER) =====
    const branchUserSubject = `Order Confirmed Successfully [Order #${order.orderNumber}]`;
    const branchUserHtmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
        <div style="background-color: #059669; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">✅ Order Confirmed Successfully</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px;">Ready for packaging and dispatch</p>
        </div>
        
        <div style="padding: 30px; background-color: white; margin: 20px;">
          <p style="color: #111827; font-size: 16px;">Hi ${order.requester.firstName},</p>
          
          <p style="color: #374151; line-height: 1.6;">
            Excellent! Your order has been <strong>confirmed</strong> and is now in the packaging stage. The manager will proceed with dispatch shortly.
          </p>

          <div style="background-color: #ecfdf5; border-left: 4px solid #059669; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <table style="width: 100%; color: #374151;">
              <tr style="border-bottom: 1px solid #d1fae5;">
                <td style="padding: 12px 0; font-weight: bold; width: 45%;">Order ID:</td>
                <td style="padding: 12px 0; color: #059669; font-weight: bold; font-size: 16px;">${order.orderNumber}</td>
              </tr>
              <tr style="border-bottom: 1px solid #d1fae5;">
                <td style="padding: 12px 0; font-weight: bold;">Branch:</td>
                <td style="padding: 12px 0;">${order.branch.name}</td>
              </tr>
              <tr style="border-bottom: 1px solid #d1fae5;">
                <td style="padding: 12px 0; font-weight: bold;">Confirmed On:</td>
                <td style="padding: 12px 0;">${new Date(order.createdAt).toLocaleString('en-IN')}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; font-weight: bold;">Status:</td>
                <td style="padding: 12px 0;">
                  <span style="background-color: #dcfce7; color: #166534; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold;">CONFIRMED</span>
                </td>
              </tr>
            </table>
          </div>

          <h3 style="color: #111827; margin-top: 30px;">📦 Order Summary</h3>
          <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 15px; margin: 15px 0; border-radius: 4px;">
            <p style="color: #0c4a6e; margin: 0;"><strong>${order.totalItems}</strong> items confirmed and ready for dispatch</p>
          </div>

          <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #0c4a6e; margin-top: 0;">📦 What Happens Next?</h3>
            <ul style="color: #0c4a6e; margin: 10px 0; padding-left: 20px;">
              <li style="margin: 8px 0;"><strong>Packaging:</strong> Items are being arranged and packed</li>
              <li style="margin: 8px 0;"><strong>Dispatch:</strong> Order will be dispatched to your branch</li>
              <li style="margin: 8px 0;"><strong>Tracking:</strong> You'll receive tracking updates via email/WhatsApp</li>
            </ul>
          </div>

          <p style="color: #6b7280; margin-top: 30px; line-height: 1.6;">
            Thank you for confirming your order! We appreciate your timely action.
          </p>

          <div style="background-color: #f3f4f6; padding: 15px; margin-top: 30px; border-radius: 4px; text-align: center;">
            <p style="color: #6b7280; margin: 0; font-size: 11px;">
              <strong>${companyName}</strong><br>
              Inventory & Procurement System<br>
              <strong>Order Reference:</strong> ${order.id}
            </p>
          </div>
        </div>

        <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">
            This is an automated notification from your inventory management system.
          </p>
        </div>
      </div>
    `;

    // ===== EMAIL FOR MANAGER =====
    const managerSubject = `Order Confirmed & Ready for Dispatch [Order #${order.orderNumber}]`;
    const managerHtmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
        <div style="background-color: #059669; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">✅ Order Confirmed by Branch</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px;">Ready for packaging and dispatch</p>
        </div>
        
        <div style="padding: 30px; background-color: white; margin: 20px;">
          <p style="color: #111827; font-size: 16px;">Hi ${manager.firstName},</p>
          
          <p style="color: #374151; line-height: 1.6;">
            Order <strong>${order.orderNumber}</strong> has been <strong>confirmed by the branch user</strong>. All approved quantities have been accepted and the order is now ready for packaging and dispatch.
          </p>

          <div style="background-color: #ecfdf5; border-left: 4px solid #059669; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <table style="width: 100%; color: #374151;">
              <tr style="border-bottom: 1px solid #d1fae5;">
                <td style="padding: 12px 0; font-weight: bold; width: 45%;">Order ID:</td>
                <td style="padding: 12px 0; color: #059669; font-weight: bold; font-size: 16px;">${order.orderNumber}</td>
              </tr>
              <tr style="border-bottom: 1px solid #d1fae5;">
                <td style="padding: 12px 0; font-weight: bold;">Confirmed By:</td>
                <td style="padding: 12px 0;">${order.requester.firstName} ${order.requester.lastName}</td>
              </tr>
              <tr style="border-bottom: 1px solid #d1fae5;">
                <td style="padding: 12px 0; font-weight: bold;">Branch:</td>
                <td style="padding: 12px 0;">${order.branch.name}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; font-weight: bold;">Status:</td>
                <td style="padding: 12px 0;">
                  <span style="background-color: #dcfce7; color: #166534; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold;">CONFIRMED</span>
                </td>
              </tr>
            </table>
          </div>

          <h3 style="color: #111827; margin-top: 30px;">📦 Order Summary</h3>
          <div style="background-color: #f3f4f6; border-left: 4px solid #6b7280; padding: 15px; margin: 15px 0; border-radius: 4px;">
            <p style="color: #374151; margin: 0;"><strong>Total Items:</strong> ${order.totalItems}</p>
          </div>

          <div style="background-color: #dbeafe; border-left: 4px solid #0284c7; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #0c4a6e; margin-top: 0;">🚀 Next Steps</h3>
            <ul style="color: #0c4a6e; margin: 10px 0; padding-left: 20px;">
              <li style="margin: 8px 0;"><strong>Begin Packaging:</strong> Start arranging and packaging confirmed items</li>
              <li style="margin: 8px 0;"><strong>Update Status:</strong> Mark order as "Under Packaging" in the system</li>
              <li style="margin: 8px 0;"><strong>Dispatch:</strong> Once packaged, dispatch with tracking information</li>
            </ul>
          </div>

          <p style="color: #6b7280; margin-top: 30px; line-height: 1.6;">
            Thank you for managing this order efficiently!
          </p>

          <div style="background-color: #f3f4f6; padding: 15px; margin-top: 30px; border-radius: 4px; text-align: center;">
            <p style="color: #6b7280; margin: 0; font-size: 11px;">
              <strong>${companyName}</strong><br>
              Inventory & Procurement System<br>
              <strong>Order Reference:</strong> ${order.id}
            </p>
          </div>
        </div>

        <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">
            This is an automated notification from your inventory management system.
          </p>
        </div>
      </div>
    `;

    // Prepare WhatsApp messages
    const branchUserWhatsAppMessage = `✅ *Order Confirmed Successfully*

Hi ${order.requester.firstName},

Your order ${order.orderNumber} has been confirmed and is now in packaging!

📦 *Order Details:*
• Order ID: ${order.orderNumber}
• Branch: ${order.branch.name}
• Total Items: ${order.totalItems}

🚚 Next steps: Packaging → Dispatch → Delivery

Thank you,
${companyName}`;

    const managerWhatsAppMessage = `✅ *Order Confirmed & Ready for Dispatch*

Hi ${manager.firstName},

Order ${order.orderNumber} has been confirmed by ${order.requester.firstName} ${order.requester.lastName}.

📦 *Order Details:*
• Order ID: ${order.orderNumber}
• Branch: ${order.branch.name}
• Total Items: ${order.totalItems}

🚀 Ready to begin packaging and dispatch!

${companyName}`;

    // Send all notifications in parallel
    const [branchEmailResult, managerEmailResult, branchWhatsAppResult, managerWhatsAppResult] = await Promise.all([
      sendEmailNotification(order.requester.email, branchUserSubject, branchUserHtmlContent),
      manager && manager.email ? sendEmailNotification(manager.email, managerSubject, managerHtmlContent) : Promise.resolve({ success: false }),
      order.requester?.phoneNumber ? sendWhatsAppNotification(order.requester.phoneNumber, branchUserWhatsAppMessage) : Promise.resolve({ success: false }),
      manager && manager.phoneNumber ? sendWhatsAppNotification(manager.phoneNumber, managerWhatsAppMessage) : Promise.resolve({ success: false })
    ]);

    return {
      success: true,
      message: 'Order confirmed notifications sent to both parties',
      branchEmail: branchEmailResult,
      managerEmail: managerEmailResult,
      branchWhatsApp: branchWhatsAppResult,
      managerWhatsApp: managerWhatsAppResult
    };

  } catch (error) {
    console.error('❌ Order confirmed notification failed:', error);
    return {
      success: false,
      message: 'Failed to send order confirmed notifications',
      error: error.message
    };
  }
};

/**
 * Send order issue raised notification (to manager)
 * @param {Object} order - Order object with all details
 * @param {string} issueReason - Reason for the issue
 * @returns {Object} Result of the notification operation
 */
const sendOrderIssueRaisedNotification = async (order, issueReason, manager) => {
  try {
    console.log(`📬 Sending order issue raised notification for order ${order.orderNumber}`);

    const companyName = 'Mystery Rooms';
    const appUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

    // ===== EMAIL FOR BRANCH USER (REQUESTER) =====
    const branchUserSubject = `Issue Raised for Order #${order.orderNumber} - Awaiting Manager Review`;
    const branchUserHtmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
        <div style="background-color: #dc2626; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">⚠️ Issue Raised Successfully</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px;">Order sent back for manager review</p>
        </div>
        
        <div style="padding: 30px; background-color: white; margin: 20px;">
          <p style="color: #111827; font-size: 16px;">Hi ${order.requester.firstName},</p>
          
          <p style="color: #374151; line-height: 1.6;">
            Your issue has been <strong>successfully raised and submitted to the manager</strong>. Order ${order.orderNumber} has been sent back for re-evaluation.
          </p>

          <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <table style="width: 100%; color: #374151;">
              <tr style="border-bottom: 1px solid #fecaca;">
                <td style="padding: 12px 0; font-weight: bold; width: 45%;">Order ID:</td>
                <td style="padding: 12px 0; color: #dc2626; font-weight: bold; font-size: 16px;">${order.orderNumber}</td>
              </tr>
              <tr style="border-bottom: 1px solid #fecaca;">
                <td style="padding: 12px 0; font-weight: bold;">Branch:</td>
                <td style="padding: 12px 0;">${order.branch.name}</td>
              </tr>
              <tr style="border-bottom: 1px solid #fecaca;">
                <td style="padding: 12px 0; font-weight: bold;">Status:</td>
                <td style="padding: 12px 0;">
                  <span style="background-color: #fee2e2; color: #991b1b; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold;">ISSUE RAISED</span>
                </td>
              </tr>
            </table>
          </div>

          <h3 style="color: #dc2626; margin-top: 30px;">📝 Your Issue Details</h3>
          <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 15px 0; border-radius: 4px;">
            <p style="color: #991b1b; margin: 0; line-height: 1.6; font-style: italic;">"${issueReason}"</p>
          </div>

          <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #0c4a6e; margin-top: 0;">📋 What Happens Next?</h3>
            <ul style="color: #0c4a6e; margin: 10px 0; padding-left: 20px;">
              <li style="margin: 8px 0;"><strong>Manager Review:</strong> The manager will review your issue and approved quantities</li>
              <li style="margin: 8px 0;"><strong>Re-approval:</strong> Manager may adjust quantities or provide explanation</li>
              <li style="margin: 8px 0;"><strong>Notification:</strong> You'll receive an update once the manager responds</li>
            </ul>
          </div>

          <p style="color: #6b7280; margin-top: 30px; line-height: 1.6;">
            Thank you for providing feedback. We'll ensure your concerns are addressed promptly.
          </p>

          <div style="background-color: #f3f4f6; padding: 15px; margin-top: 30px; border-radius: 4px; text-align: center;">
            <p style="color: #6b7280; margin: 0; font-size: 11px;">
              <strong>${companyName}</strong><br>
              Inventory & Procurement System<br>
              <strong>Order Reference:</strong> ${order.id}
            </p>
          </div>
        </div>

        <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">
            This is an automated notification from your inventory management system.
          </p>
        </div>
      </div>
    `;

    // ===== EMAIL FOR MANAGER =====
    const managerSubject = `⚠️ Order Issue Raised - Requires Your Review [Order #${order.orderNumber}]`;
    const managerHtmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
        <div style="background-color: #dc2626; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">⚠️ Order Issue Raised</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px;">Branch user has raised a concern - Action required</p>
        </div>
        
        <div style="padding: 30px; background-color: white; margin: 20px;">
          <p style="color: #111827; font-size: 16px;">Hi ${manager.firstName},</p>
          
          <p style="color: #374151; line-height: 1.6;">
            An <strong>issue has been raised</strong> by the branch user for order ${order.orderNumber}. The branch has concerns about the approved quantities and the order requires your re-evaluation.
          </p>

          <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <table style="width: 100%; color: #374151;">
              <tr style="border-bottom: 1px solid #fecaca;">
                <td style="padding: 12px 0; font-weight: bold; width: 45%;">Order ID:</td>
                <td style="padding: 12px 0; color: #dc2626; font-weight: bold; font-size: 16px;">${order.orderNumber}</td>
              </tr>
              <tr style="border-bottom: 1px solid #fecaca;">
                <td style="padding: 12px 0; font-weight: bold;">Raised By:</td>
                <td style="padding: 12px 0;">${order.requester.firstName} ${order.requester.lastName}</td>
              </tr>
              <tr style="border-bottom: 1px solid #fecaca;">
                <td style="padding: 12px 0; font-weight: bold;">Branch:</td>
                <td style="padding: 12px 0;">${order.branch.name}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; font-weight: bold;">Status:</td>
                <td style="padding: 12px 0;">
                  <span style="background-color: #fee2e2; color: #991b1b; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold;">ISSUE RAISED</span>
                </td>
              </tr>
            </table>
          </div>

          <h3 style="color: #dc2626; margin-top: 30px;">📝 Branch's Concern</h3>
          <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 15px 0; border-radius: 4px;">
            <p style="color: #991b1b; margin: 0; line-height: 1.6; font-style: italic;">"${issueReason}"</p>
          </div>

          <h3 style="color: #111827; margin-top: 30px;">📦 Order Summary</h3>
          <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 15px; margin: 15px 0; border-radius: 4px;">
            <p style="color: #0c4a6e; margin: 0;"><strong>${order.totalItems}</strong> items were approved in this order</p>
          </div>

          <div style="background-color: #fef3c7; border-left: 4px solid #eab308; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #713f12; margin-top: 0;">⚡ Action Required</h3>
            <p style="color: #713f12; margin: 10px 0; line-height: 1.6;">
              Please review the branch's concern and decide on one of the following:
            </p>
            <ul style="color: #713f12; margin: 10px 0; padding-left: 20px;">
              <li style="margin: 8px 0;"><strong>📝 Provide Explanation:</strong> Explain why the approved quantities are necessary</li>
              <li style="margin: 8px 0;"><strong>📊 Re-adjust Quantities:</strong> Modify the approved quantities based on feedback</li>
              <li style="margin: 8px 0;"><strong>💬 Send Message:</strong> Communicate directly with the branch user</li>
            </ul>
          </div>

          <p style="color: #6b7280; margin-top: 30px; line-height: 1.6;">
            Please respond promptly to resolve this issue and keep the order workflow moving.
          </p>

          <div style="background-color: #f3f4f6; padding: 15px; margin-top: 30px; border-radius: 4px; text-align: center;">
            <p style="color: #6b7280; margin: 0; font-size: 11px;">
              <strong>${companyName}</strong><br>
              Inventory & Procurement System<br>
              <strong>Order Reference:</strong> ${order.id}
            </p>
          </div>
        </div>

        <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">
            This is an automated notification from your inventory management system.
          </p>
        </div>
      </div>
    `;

    // Prepare WhatsApp messages
    const branchUserWhatsAppMessage = `⚠️ *Issue Raised Successfully*

Hi ${order.requester.firstName},

Your issue for order ${order.orderNumber} has been submitted to the manager.

📦 *Order ID:* ${order.orderNumber}
📍 *Branch:* ${order.branch.name}

⚠️ *Your Concern:*
"${issueReason}"

👨‍💼 The manager will review and respond to your concern shortly.

Thank you,
${companyName}`;

    const managerWhatsAppMessage = `⚠️ *Order Issue Raised - Needs Your Review*

Hi ${manager.firstName},

Order ${order.orderNumber} has an issue raised by ${order.requester.firstName} ${order.requester.lastName}.

📦 *Order ID:* ${order.orderNumber}
📍 *Branch:* ${order.branch.name}

⚠️ *Concern:*
"${issueReason}"

📋 Please review and take appropriate action:
• Provide explanation
• Re-adjust quantities
• Send message to branch

${companyName}`;

    // Send all notifications in parallel
    const [branchEmailResult, managerEmailResult, branchWhatsAppResult, managerWhatsAppResult] = await Promise.all([
      sendEmailNotification(order.requester.email, branchUserSubject, branchUserHtmlContent),
      manager && manager.email ? sendEmailNotification(manager.email, managerSubject, managerHtmlContent) : Promise.resolve({ success: false }),
      order.requester?.phoneNumber ? sendWhatsAppNotification(order.requester.phoneNumber, branchUserWhatsAppMessage) : Promise.resolve({ success: false }),
      manager && manager.phoneNumber ? sendWhatsAppNotification(manager.phoneNumber, managerWhatsAppMessage) : Promise.resolve({ success: false })
    ]);

    return {
      success: true,
      message: 'Order issue notifications sent to both parties',
      branchEmail: branchEmailResult,
      managerEmail: managerEmailResult,
      branchWhatsApp: branchWhatsAppResult,
      managerWhatsApp: managerWhatsAppResult
    };

  } catch (error) {
    console.error('❌ Order issue raised notification failed:', error);
    return {
      success: false,
      message: 'Failed to send order issue raised notifications',
      error: error.message
    };
  }
};

/**
 * Send manager reply notification (to branch user)
 * @param {Object} order - Order object with all details
 * @param {string} reply - Manager's reply
 * @returns {Object} Result of the notification operation
 */
const sendManagerReplyNotification = async (order, reply) => {
  try {
    console.log(`📬 Sending manager reply notification for order ${order.orderNumber}`);

    // Prepare email content for branch user
    const emailSubject = `Manager Reply: ${order.orderNumber}`;
    const emailHtmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3b82f6;">💬 Manager Reply Received</h2>
        <p>Dear ${order.requester.firstName} ${order.requester.lastName},</p>
        
        <p>Your manager has replied to the issue you raised for order <strong>${order.orderNumber}</strong>.</p>
        
        <div style="background-color: #eff6ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #1e40af; margin-top: 0;">Manager's Reply:</h3>
          <p style="color: #1e40af;">${reply}</p>
        </div>

        <h3>Order Details:</h3>
        <ul>
          <li><strong>Order Number:</strong> ${order.orderNumber}</li>
          <li><strong>Branch:</strong> ${order.branch.name}</li>
          <li><strong>Total Items:</strong> ${order.totalItems}</li>
          <li><strong>Order Value:</strong> ₹${order.totalValue ? order.totalValue.toFixed(2) : '0.00'}</li>
        </ul>

        <p>Please review the manager's reply and take appropriate action.</p>
        
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px;">
          This is an automated notification. Please do not reply to this email.
        </p>
      </div>
    `;

    // Prepare WhatsApp message for branch user
    const whatsAppMessage = `💬 *Manager Reply: ${order.orderNumber}*

Dear ${order.requester.firstName},

Your manager has replied to the issue you raised for order ${order.orderNumber}!

📦 *Order Details:*
• Order: ${order.orderNumber}
• Branch: ${order.branch.name}
• Items: ${order.totalItems}
• Value: $${order.totalValue ? order.totalValue.toFixed(2) : '0.00'}

💬 *Manager's Reply:*
${reply}

Please review the manager's reply and take appropriate action.

Thank you! 🚀`;

    // Send notifications to branch user
    const [emailResult, whatsAppResult] = await Promise.all([
      sendEmailNotification(order.requester.email, emailSubject, emailHtmlContent),
      sendWhatsAppNotification(order.requester?.phoneNumber || process.env.SMARTWHAP_TEST_NUMBER, whatsAppMessage) // use requester phoneNumber or fallback
    ]);

    return {
      success: true,
      message: 'Manager reply notifications sent',
      emailResult,
      whatsAppResult
    };

  } catch (error) {
    console.error('❌ Manager reply notification failed:', error);
    return {
      success: false,
      message: 'Failed to send manager reply notifications',
      error: error.message
    };
  }
};

/**
 * Send order status update notification (to branch user)
 * @param {Object} order - Order object with all details
 * @param {string} newStatus - New status
 * @returns {Object} Result of the notification operation
 */
const sendOrderStatusUpdateNotification = async (order, newStatus) => {
  try {
    console.log(`📬 Sending order status update notification for order ${order.orderNumber}`);

    const statusMessages = {
      'ARRANGING': {
        subject: 'Order Status Updated – Items Are Now Being Arranged',
        title: '🧰 Arranging Items (In Progress)',
        message: 'This is to inform you that the order status has been updated by the Manager. The required items are now in the Arranging Items stage.',
        emoji: '🧰'
      },
      'PACKAGING_COMPLETED': {
        subject: 'Your Order is Ready for Dispatch',
        title: '✅ Packaging Completed',
        message: 'Your order has been successfully packaged and is now ready for dispatch.',
        emoji: '✅'
      },
      'ARRIVED': {
        subject: 'Order Received – Confirmation',
        title: '✅ Order Received',
        message: 'Your order has been successfully delivered and received at your branch.',
        emoji: '✅'
      },
      'ARRANGED': {
        subject: 'Order Arranged',
        title: '✅ Order Arranged',
        message: 'Items for your order have been arranged and are ready at the branch.',
        emoji: '✅'
      },
      'SENT_FOR_PACKAGING': {
        subject: 'Order Sent for Packaging – Processing in Progress',
        title: '📤 Sent for Packaging',
        message: 'Your order has successfully moved to the next processing stage. All required items have been arranged and the order has now been sent to the Packaging Team.',
        emoji: '📤'
      },
      'UNDER_PACKAGING': {
        subject: 'Your Order is Under Packaging',
        title: '📦 Order Under Packaging',
        message: 'Your approved order has now entered the Packaging Stage and is currently being prepared by the Packaging Team.',
        emoji: '📦'
      },
      'IN_TRANSIT': {
        subject: 'Your Order is In Transit – Tracking Details',
        title: '🚚 Order In Transit',
        message: 'Your order has been dispatched and is now in transit to your branch.',
        emoji: '🚚'
      },
      'RECEIVED': {
        subject: 'Order Received – Confirmation',
        title: '✅ Order Received',
        message: 'Your order has been successfully delivered and received at your branch.',
        emoji: '✅'
      },
    };

    // Map database status to template status
    const templateStatus = newStatus === 'CONFIRM_ORDER_RECEIVED' ? 'RECEIVED' : newStatus;
    
    const statusInfo = statusMessages[templateStatus];
    if (!statusInfo) {
      console.warn(`No configured notification message for status: ${templateStatus}. Skipping email/whatsapp notifications.`);
      return { success: true, message: 'No notification configured for this status' };
    }

    // Prepare email content for branch user
    const emailSubject = `${statusInfo.subject} (Order ID: ${order.orderNumber})`;
    
    // Debug logging for tracking data
    console.log(`🔍 [DEBUG] Tracking data for order ${order.orderNumber}:`, {
      tracking: order.tracking,
      trackingId: order.tracking?.trackingId,
      courierLink: order.tracking?.courierLink,
      expectedDeliveryTime: order.expectedDeliveryTime
    });
    const companyName = 'Mystery Rooms';
    const emailHtmlContent = newStatus === 'ARRANGING'
      ? `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
        <div style="background-color: #2563eb; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">🧰 Order Status Updated</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px;">Items Are Now Being Arranged</p>
        </div>
        <div style="padding: 30px; background-color: white; margin: 20px;">
          <p style="color: #111827; font-size: 16px;">Dear ${order.branch?.name || 'Branch'} Team,</p>
          <p style="color: #374151; line-height: 1.6;">
            This is to inform you that the order status has been updated by the Manager.<br/>
            The required items are now in the <strong>Arranging Items</strong> stage.
          </p>

          <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #1e3a8a; margin-top: 0;">Order Details</h3>
            <table style="width: 100%; color: #374151;">
              <tr style="border-bottom: 1px solid #bfdbfe;">
                <td style="padding: 12px 0; font-weight: bold; width: 45%;">Order ID:</td>
                <td style="padding: 12px 0; color: #2563eb; font-weight: bold; font-size: 16px;">${order.orderNumber}</td>
              </tr>
              <tr style="border-bottom: 1px solid #bfdbfe;">
                <td style="padding: 12px 0; font-weight: bold;">Request Date:</td>
                <td style="padding: 12px 0;">${order.requestedAt ? new Date(order.requestedAt).toLocaleString('en-IN') : ''}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; font-weight: bold;">Branch / Location:</td>
                <td style="padding: 12px 0;">${order.branch?.name || ''}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #fef3c7; border-left: 4px solid #eab308; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #713f12; margin-top: 0;">Current Status</h3>
            <p style="color: #713f12; margin: 10px 0; line-height: 1.6; font-weight: bold;">
              Manager Approved → Branch Confirmed → Arranging Items (In Progress)
            </p>
          </div>

          <div style="background-color: #ecfdf5; border-left: 4px solid #059669; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #065f46; margin-top: 0;">Next Step</h3>
            <p style="color: #065f46; margin: 10px 0; line-height: 1.6;">
              Once all items are successfully arranged, the order will move forward to <strong>Packaging / Dispatch Preparation</strong>.
              Please stay prepared for the next update.
            </p>
          </div>

          <p style="color: #6b7280; margin-top: 30px; line-height: 1.6;">
            Thank you,
          </p>

          <div style="background-color: #f3f4f6; padding: 15px; margin-top: 30px; border-radius: 4px; text-align: center;">
            <p style="color: #6b7280; margin: 0; font-size: 11px;">
              <strong>${companyName}</strong><br>
              Inventory & Procurement System<br>
              <strong>Order Reference:</strong> ${order.id}
            </p>
          </div>
        </div>
        <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">
            This is an automated notification from your inventory management system.
          </p>
        </div>
      </div>
      `
      : newStatus === 'ARRANGED'
      ? `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
        <div style="background-color: #059669; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">✅ Items Arranged</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px;">Order Status Updated</p>
        </div>
        <div style="padding: 30px; background-color: white; margin: 20px;">
          <p style="color: #111827; font-size: 16px;">Dear ${order.requester.firstName} ${order.requester.lastName},</p>
          <p style="color: #374151; line-height: 1.6;">
            This is to inform you that the order status has been updated by the Manager.<br/>
            Items for your order have been <strong>successfully arranged</strong> and are ready at the branch.
          </p>

          <div style="background-color: #f0fdf4; border-left: 4px solid #059669; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #065f46; margin-top: 0;">Order Details</h3>
            <table style="width: 100%; color: #374151;">
              <tr style="border-bottom: 1px solid #d1fae5;">
                <td style="padding: 12px 0; font-weight: bold; width: 45%;">Order ID:</td>
                <td style="padding: 12px 0; color: #059669; font-weight: bold; font-size: 16px;">${order.orderNumber}</td>
              </tr>
              <tr style="border-bottom: 1px solid #d1fae5;">
                <td style="padding: 12px 0; font-weight: bold;">Request Date:</td>
                <td style="padding: 12px 0;">${order.requestedAt ? new Date(order.requestedAt).toLocaleString('en-IN') : ''}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; font-weight: bold;">Branch / Location:</td>
                <td style="padding: 12px 0;">${order.branch?.name || ''}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #ecfdf5; border-left: 4px solid #059669; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <p style="color: #065f46; margin: 0; line-height: 1.6; font-weight: bold;">
              ✅ Your items have been arranged and are ready for collection.
            </p>
          </div>

          <p style="color: #6b7280; margin-top: 30px; line-height: 1.6;">
            Thank you,
          </p>

          <div style="background-color: #f3f4f6; padding: 15px; margin-top: 30px; border-radius: 4px; text-align: center;">
            <p style="color: #6b7280; margin: 0; font-size: 11px;">
              <strong>${companyName}</strong><br>
              Inventory & Procurement System<br>
              <strong>Order Reference:</strong> ${order.id}
            </p>
          </div>
        </div>
        <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">
            This is an automated notification from your inventory management system.
          </p>
        </div>
      </div>
      `
      : newStatus === 'SENT_FOR_PACKAGING'
      ? `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
        <div style="background-color: #7c3aed; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">📤 Order Sent for Packaging</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px;">Processing in Progress</p>
        </div>
        <div style="padding: 30px; background-color: white; margin: 20px;">
          <p style="color: #111827; font-size: 16px;">Dear ${order.branch?.name || 'Branch'} Team,</p>
          <p style="color: #374151; line-height: 1.6;">
            Your order has successfully moved to the next processing stage.<br/>
            All required items have been arranged and the order has now been sent to the <strong>Packaging Team</strong>.
          </p>

          <div style="background-color: #f5f3ff; border-left: 4px solid #7c3aed; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #4c1d95; margin-top: 0;">Order Details</h3>
            <table style="width: 100%; color: #374151;">
              <tr style="border-bottom: 1px solid #ddd6fe;">
                <td style="padding: 12px 0; font-weight: bold; width: 45%;">Order ID:</td>
                <td style="padding: 12px 0; color: #7c3aed; font-weight: bold; font-size: 16px;">${order.orderNumber}</td>
              </tr>
              <tr style="border-bottom: 1px solid #ddd6fe;">
                <td style="padding: 12px 0; font-weight: bold;">Request Date:</td>
                <td style="padding: 12px 0;">${order.requestedAt ? new Date(order.requestedAt).toLocaleString('en-IN') : ''}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; font-weight: bold;">Branch / Location:</td>
                <td style="padding: 12px 0;">${order.branch?.name || ''}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #fef3c7; border-left: 4px solid #eab308; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #713f12; margin-top: 0;">Current Status Flow</h3>
            <p style="color: #713f12; margin: 10px 0; line-height: 1.6; font-weight: bold;">
              Requested → Manager Approved → Branch Confirmed → Arranging Completed → Sent for Packaging
            </p>
          </div>

          <div style="background-color: #ecfdf5; border-left: 4px solid #059669; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <p style="color: #065f46; margin: 0; line-height: 1.6; font-weight: bold;">
              No action is required from your side at this moment.
            </p>
            <p style="color: #065f46; margin: 10px 0 0 0; line-height: 1.6;">
              You will receive another update once packaging is completed and the order proceeds to Dispatch / Handover.
            </p>
          </div>

          <p style="color: #6b7280; margin-top: 30px; line-height: 1.6;">
            Thank you,
          </p>

          <div style="background-color: #f3f4f6; padding: 15px; margin-top: 30px; border-radius: 4px; text-align: center;">
            <p style="color: #6b7280; margin: 0; font-size: 11px;">
              <strong>${companyName}</strong><br>
              Inventory & Procurement System<br>
              <strong>Order Reference:</strong> ${order.id}
            </p>
          </div>
        </div>
        <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">
            This is an automated notification from your inventory management system.
          </p>
        </div>
      </div>
      `
      : newStatus === 'UNDER_PACKAGING'
      ? `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
        <div style="background-color: #ea580c; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">📦 Your Order is Under Packaging</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px;">Being Prepared</p>
        </div>
        <div style="padding: 30px; background-color: white; margin: 20px;">
          <p style="color: #111827; font-size: 16px;">Dear ${order.branch?.name || 'Branch'} Team,</p>
          <p style="color: #374151; line-height: 1.6;">
            Your approved order has now entered the <strong>Packaging Stage</strong> and is currently being prepared by the Packaging Team.
          </p>

          <div style="background-color: #fff7ed; border-left: 4px solid #ea580c; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #7c2d12; margin-top: 0;">Order Details</h3>
            <table style="width: 100%; color: #374151;">
              <tr style="border-bottom: 1px solid #fed7aa;">
                <td style="padding: 12px 0; font-weight: bold; width: 45%;">Order ID:</td>
                <td style="padding: 12px 0; color: #ea580c; font-weight: bold; font-size: 16px;">${order.orderNumber}</td>
              </tr>
              <tr style="border-bottom: 1px solid #fed7aa;">
                <td style="padding: 12px 0; font-weight: bold;">Request Date:</td>
                <td style="padding: 12px 0;">${order.requestedAt ? new Date(order.requestedAt).toLocaleString('en-IN') : ''}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; font-weight: bold;">Current Status Flow:</td>
                <td style="padding: 12px 0;">Requested → Manager Approved → Branch Confirmed → Arranging Completed → Under Packaging</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #ecfdf5; border-left: 4px solid #059669; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <p style="color: #065f46; margin: 0; line-height: 1.6; font-weight: bold;">
              No action is required from your side at the moment.
            </p>
            <p style="color: #065f46; margin: 10px 0 0 0; line-height: 1.6;">
              You will receive another update once the order is ready for dispatch.
            </p>
          </div>

          <p style="color: #6b7280; margin-top: 30px; line-height: 1.6;">
            Thank you,
          </p>

          <div style="background-color: #f3f4f6; padding: 15px; margin-top: 30px; border-radius: 4px; text-align: center;">
            <p style="color: #6b7280; margin: 0; font-size: 11px;">
              <strong>${companyName}</strong><br>
              Inventory & Procurement System<br>
              <strong>Order Reference:</strong> ${order.id}
            </p>
          </div>
        </div>
        <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">
            This is an automated notification from your inventory management system.
          </p>
        </div>
      </div>
      `
      : newStatus === 'PACKAGING_COMPLETED'
      ? `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
        <div style="background-color: #059669; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">✅ Your Order is Ready for Dispatch</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px;">Packaging Completed</p>
        </div>
        <div style="padding: 30px; background-color: white; margin: 20px;">
          <p style="color: #111827; font-size: 16px;">Dear ${order.branch?.name || 'Branch'} Team,</p>
          <p style="color: #374151; line-height: 1.6;">
            Your order has been <strong>successfully packaged</strong> and is now ready for dispatch.
          </p>

          <div style="background-color: #ecfdf5; border-left: 4px solid #059669; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #065f46; margin-top: 0;">Order Details</h3>
            <table style="width: 100%; color: #374151;">
              <tr style="border-bottom: 1px solid #a7f3d0;">
                <td style="padding: 12px 0; font-weight: bold; width: 45%;">Order ID:</td>
                <td style="padding: 12px 0; color: #059669; font-weight: bold; font-size: 16px;">${order.orderNumber}</td>
              </tr>
              <tr style="border-bottom: 1px solid #a7f3d0;">
                <td style="padding: 12px 0; font-weight: bold;">Request Date:</td>
                <td style="padding: 12px 0;">${order.requestedAt ? new Date(order.requestedAt).toLocaleString('en-IN') : ''}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; font-weight: bold;">Current Status Flow:</td>
                <td style="padding: 12px 0;">Requested → Manager Approved → Branch Confirmed → Arranging Completed → Packaging Completed / Ready for Dispatch</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <p style="color: #075985; margin: 0; line-height: 1.6; font-weight: bold;">
              No action is required from your side.
            </p>
            <p style="color: #075985; margin: 10px 0 0 0; line-height: 1.6;">
              You will receive the next update once the order is dispatched to your branch.
            </p>
          </div>

          <p style="color: #6b7280; margin-top: 30px; line-height: 1.6;">
            Thank you,
          </p>

          <div style="background-color: #f3f4f6; padding: 15px; margin-top: 30px; border-radius: 4px; text-align: center;">
            <p style="color: #6b7280; margin: 0; font-size: 11px;">
              <strong>${companyName}</strong><br>
              Inventory & Procurement System<br>
              <strong>Order Reference:</strong> ${order.id}
            </p>
          </div>
        </div>
        <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">
            This is an automated notification from your inventory management system.
          </p>
        </div>
      </div>
      `
      : newStatus === 'IN_TRANSIT'
      ? `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
        <div style="background-color: #dc2626; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">🚚 Your Order is In Transit</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px;">Tracking Details</p>
        </div>
        <div style="padding: 30px; background-color: white; margin: 20px;">
          <p style="color: #111827; font-size: 16px;">Dear ${order.branch?.name || 'Branch'} Team,</p>
          <p style="color: #374151; line-height: 1.6;">
            Your order has been <strong>dispatched</strong> and is now in transit to your branch.
          </p>

          <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #7f1d1d; margin-top: 0;">Order Details</h3>
            <table style="width: 100%; color: #374151;">
              <tr style="border-bottom: 1px solid #fecaca;">
                <td style="padding: 12px 0; font-weight: bold; width: 45%;">Order ID:</td>
                <td style="padding: 12px 0; color: #dc2626; font-weight: bold; font-size: 16px;">${order.orderNumber}</td>
              </tr>
              <tr style="border-bottom: 1px solid #fecaca;">
                <td style="padding: 12px 0; font-weight: bold;">Request Date:</td>
                <td style="padding: 12px 0;">${order.requestedAt ? new Date(order.requestedAt).toLocaleString('en-IN') : ''}</td>
              </tr>
              <tr style="border-bottom: 1px solid #fecaca;">
                <td style="padding: 12px 0; font-weight: bold;">Tracking ID:</td>
                <td style="padding: 12px 0;">${order.tracking?.trackingId || 'N/A'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #fecaca;">
                <td style="padding: 12px 0; font-weight: bold;">Tracking Link:</td>
                <td style="padding: 12px 0;">
                  ${order.tracking?.courierLink ? `<a href="${order.tracking.courierLink}" style="color: #dc2626; text-decoration: none;">Track Your Order</a>` : 'N/A'}
                </td>
              </tr>
              <tr>
                <td style="padding: 12px 0; font-weight: bold;">Expected Delivery:</td>
                <td style="padding: 12px 0;">${order.expectedDeliveryTime ? new Date(order.expectedDeliveryTime).toLocaleString('en-IN') : 'N/A'}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #075985; margin-top: 0;">Current Status Flow</h3>
            <p style="color: #075985; margin: 10px 0; line-height: 1.6; font-weight: bold;">
              Requested → Manager Approved → Branch Confirmed → Arranging Completed → Packaging Completed → In Transit
            </p>
          </div>

          <div style="background-color: #ecfdf5; border-left: 4px solid #059669; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <p style="color: #065f46; margin: 0; line-height: 1.6; font-weight: bold;">
              No action is required from your side. You can track the shipment using the provided link.
            </p>
            <p style="color: #065f46; margin: 10px 0 0 0; line-height: 1.6;">
              Photos / Videos of the dispatched items are also attached (if available).
            </p>
          </div>

          <p style="color: #6b7280; margin-top: 30px; line-height: 1.6;">
            Thank you,
          </p>

          <div style="background-color: #f3f4f6; padding: 15px; margin-top: 30px; border-radius: 4px; text-align: center;">
            <p style="color: #6b7280; margin: 0; font-size: 11px;">
              <strong>${companyName}</strong><br>
              Inventory & Procurement System<br>
              <strong>Order Reference:</strong> ${order.id}
            </p>
          </div>
        </div>
        <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">
            This is an automated notification from your inventory management system.
          </p>
        </div>
      </div>
      `
      : templateStatus === 'RECEIVED'
      ? `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
        <div style="background-color: #059669; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">✅ Order Received</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px;">Confirmation</p>
        </div>
        <div style="padding: 30px; background-color: white; margin: 20px;">
          <p style="color: #111827; font-size: 16px;">Dear ${order.branch?.name || 'Branch'} Team,</p>
          <p style="color: #374151; line-height: 1.6;">
            Good news! Your order has been <strong>successfully delivered and received</strong> at your branch.
          </p>

          <div style="background-color: #ecfdf5; border-left: 4px solid #059669; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #065f46; margin-top: 0;">Order Details</h3>
            <table style="width: 100%; color: #374151;">
              <tr style="border-bottom: 1px solid #d1fae5;">
                <td style="padding: 12px 0; font-weight: bold; width: 45%;">Order ID:</td>
                <td style="padding: 12px 0; color: #059669; font-weight: bold; font-size: 16px;">${order.orderNumber}</td>
              </tr>
              <tr style="border-bottom: 1px solid #d1fae5;">
                <td style="padding: 12px 0; font-weight: bold;">Request Date:</td>
                <td style="padding: 12px 0;">${order.requestedAt ? new Date(order.requestedAt).toLocaleString('en-IN') : ''}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; font-weight: bold;">Delivery Date / Time:</td>
                <td style="padding: 12px 0;">${new Date().toLocaleString('en-IN')}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #075985; margin-top: 0;">Current Status Flow</h3>
            <p style="color: #075985; margin: 10px 0; line-height: 1.6; font-weight: bold;">
              Requested → Manager Approved → Branch Confirmed → Arranging Completed → Packaging Completed → In Transit → Delivered / Received
            </p>
          </div>

          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <p style="color: #92400e; margin: 0; line-height: 1.6; font-weight: bold;">
              Please verify the items and their condition upon receipt.
            </p>
            <p style="color: #92400e; margin: 10px 0 0 0; line-height: 1.6;">
              You can also review any attached Photos / Videos of the delivered items.
            </p>
            <p style="color: #92400e; margin: 10px 0 0 0; line-height: 1.6;">
              Once verified, kindly update the system to mark the order as Received / Completed.
            </p>
          </div>

          <p style="color: #6b7280; margin-top: 30px; line-height: 1.6;">
            Thank you,
          </p>

          <div style="background-color: #f3f4f6; padding: 15px; margin-top: 30px; border-radius: 4px; text-align: center;">
            <p style="color: #6b7280; margin: 0; font-size: 11px;">
              <strong>${companyName}</strong><br>
              Inventory & Procurement System<br>
              <strong>Order Reference:</strong> ${order.id}
            </p>
          </div>
        </div>
        <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">
            This is an automated notification from your inventory management system.
          </p>
        </div>
      </div>
      `
      : `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">${statusInfo.title}</h2>
        <p>Dear ${order.requester.firstName} ${order.requester.lastName},</p>
        
        <p>${statusInfo.message}</p>
        
        <h3>Order Details:</h3>
        <ul>
          <li><strong>Order Number:</strong> ${order.orderNumber}</li>
          <li><strong>Branch:</strong> ${order.branch.name}</li>
          <li><strong>Total Items:</strong> ${order.totalItems}</li>
          <li><strong>Order Value:</strong> ₹${order.totalValue ? order.totalValue.toFixed(2) : '0.00'}</li>
        </ul>

        ${newStatus === 'IN_TRANSIT' ? '<p>You will be able to track your order and confirm receipt once it arrives.</p>' : ''}
        
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px;">
          This is an automated notification. Please do not reply to this email.
        </p>
      </div>
    `;

    // Prepare WhatsApp message for branch user
    const whatsAppMessage = `${statusInfo.emoji} *${statusInfo.subject}: ${order.orderNumber}*

Dear ${order.requester.firstName},

${statusInfo.message}

📦 *Order Details:*
• Order: ${order.orderNumber}
• Branch: ${order.branch.name}
• Items: ${order.totalItems}
• Value: ₹${order.totalValue ? order.totalValue.toFixed(2) : '0.00'}

${templateStatus === 'IN_TRANSIT' ? 'You will be able to track your order and confirm receipt once it arrives.' : ''}

Thank you! 🚀`;

    // Send notifications to branch user
    const recipientEmail = order.requester?.email || (await prisma.user.findUnique({ where: { id: order.requesterId }, select: { email: true } }))?.email;
    console.log(`🔍 [DEBUG] About to send email to:`, recipientEmail);
    console.log(`🔍 [DEBUG] Email subject:`, emailSubject);
    console.log(`🔍 [DEBUG] SMTP_HOST:`, process.env.SMTP_HOST);
    console.log(`🔍 [DEBUG] SMTP_USER:`, process.env.SMTP_USER);
    if (!recipientEmail) {
      console.error('❌ No recipient email found for order', order.orderNumber, 'requesterId:', order.requesterId);
      return { success: false, message: 'No recipient email found' };
    }
    const [emailResult, whatsAppResult] = await Promise.all([
      sendEmailNotification(recipientEmail, emailSubject, emailHtmlContent),
      sendWhatsAppNotification(order.requester?.phoneNumber || process.env.SMARTWHAP_TEST_NUMBER, whatsAppMessage) // use requester phoneNumber or fallback
    ]);
    console.log(`🔍 [DEBUG] Email result:`, emailResult);
    console.log(`🔍 [DEBUG] WhatsApp result:`, whatsAppResult);

    return {
      success: true,
      message: 'Order status update notifications sent',
      emailResult,
      whatsAppResult
    };

  } catch (error) {
    console.error('❌ Order status update notification failed:', error);
    return {
      success: false,
      message: 'Failed to send order status update notifications',
      error: error.message
    };
  }
};

/**
 * Send order received notification (to manager)
 * @param {Object} order - Order object with all details
 * @returns {Object} Result of the notification operation
 */
const sendOrderReceivedNotification = async (order) => {
  try {
    console.log(`📬 Sending order received notification for order ${order.orderNumber}`);

    // Prepare email content for manager
    const emailSubject = `Order Received Confirmed: ${order.orderNumber}`;
    const emailHtmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">✅ Order Received Confirmed</h2>
        <p>Dear Manager,</p>
        
        <p>Order <strong>${order.orderNumber}</strong> has been confirmed as received by the branch user.</p>
        
        <h3>Order Details:</h3>
        <ul>
          <li><strong>Order Number:</strong> ${order.orderNumber}</li>
          <li><strong>Branch:</strong> ${order.branch.name}</li>
          <li><strong>Requester:</strong> ${order.requester.firstName} ${order.requester.lastName}</li>
          <li><strong>Total Items:</strong> ${order.totalItems}</li>
          <li><strong>Order Value:</strong> ₹${order.totalValue ? order.totalValue.toFixed(2) : '0.00'}</li>
        </ul>

        <p>You can now close this order to complete the workflow.</p>
        
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px;">
          This is an automated notification. Please do not reply to this email.
        </p>
      </div>
    `;

    // Prepare WhatsApp message for manager
    const whatsAppMessage = `✅ *Order Received Confirmed: ${order.orderNumber}*

Dear Manager,

Order ${order.orderNumber} has been confirmed as received by ${order.requester.firstName} ${order.requester.lastName}!

📦 *Order Details:*
• Order: ${order.orderNumber}
• Branch: ${order.branch.name}
• Requester: ${order.requester.firstName} ${order.requester.lastName}
• Items: ${order.totalItems}
• Value: ₹${order.totalValue ? order.totalValue.toFixed(2) : '0.00'}

You can now close this order to complete the workflow.

Thank you! 🚀`;

    // Send notifications to manager
    const [emailResult, whatsAppResult] = await Promise.all([
      sendEmailNotification('manager@company.com', emailSubject, emailHtmlContent), // TODO: Get actual manager email
      sendWhatsAppNotification(order.requester?.phoneNumber || process.env.SMARTWHAP_TEST_NUMBER, whatsAppMessage) // use requester phoneNumber or fallback
    ]);

    return {
      success: true,
      message: 'Order received notifications sent',
      emailResult,
      whatsAppResult
    };

  } catch (error) {
    console.error('❌ Order received notification failed:', error);
    return {
      success: false,
      message: 'Failed to send order received notifications',
      error: error.message
    };
  }
};

/**
 * Send order closed notification (to branch user)
 * @param {Object} order - Order object with all details
 * @returns {Object} Result of the notification operation
 */
const sendOrderClosedNotification = async (order) => {
  try {
    console.log(`📬 Sending order closed notification for order ${order.orderNumber}`);

    // Prepare email content for branch user
    const emailSubject = `Order Closed: ${order.orderNumber}`;
    const emailHtmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6b7280;">🔒 Order Closed</h2>
        <p>Dear ${order.requester.firstName} ${order.requester.lastName},</p>
        
        <p>Order <strong>${order.orderNumber}</strong> has been closed and completed successfully.</p>
        
        <h3>Order Details:</h3>
        <ul>
          <li><strong>Order Number:</strong> ${order.orderNumber}</li>
          <li><strong>Branch:</strong> ${order.branch.name}</li>
          <li><strong>Total Items:</strong> ${order.totalItems}</li>
          <li><strong>Order Value:</strong> ₹${order.totalValue ? order.totalValue.toFixed(2) : '0.00'}</li>
        </ul>

        <p>Thank you for using our inventory management system!</p>
        
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px;">
          This is an automated notification. Please do not reply to this email.
        </p>
      </div>
    `;

    // Prepare WhatsApp message for branch user
    const whatsAppMessage = `🔒 *Order Closed: ${order.orderNumber}*

Dear ${order.requester.firstName},

Order ${order.orderNumber} has been closed and completed successfully!

📦 *Order Details:*
• Order: ${order.orderNumber}
• Branch: ${order.branch.name}
• Items: ${order.totalItems}
• Value: ₹${order.totalValue ? order.totalValue.toFixed(2) : '0.00'}

Thank you for using our inventory management system!

Thank you! 🚀`;

    // Send notifications to branch user
    const [emailResult, whatsAppResult] = await Promise.all([
      sendEmailNotification(order.requester.email, emailSubject, emailHtmlContent),
      sendWhatsAppNotification(order.requester?.phoneNumber || process.env.SMARTWHAP_TEST_NUMBER, whatsAppMessage) // use requester phoneNumber or fallback
    ]);

    return {
      success: true,
      message: 'Order closed notifications sent',
      emailResult,
      whatsAppResult
    };

  } catch (error) {
    console.error('❌ Order closed notification failed:', error);
    return {
      success: false,
      message: 'Failed to send order closed notifications',
      error: error.message
    };
  }
};

/**
 * Send manager reply confirmation notification (to manager)
 * @param {Object} order - Order object with all details
 * @returns {Object} Result of the notification operation
 */
const sendManagerReplyConfirmationNotification = async (order) => {
  try {
    console.log(`📬 Sending manager reply confirmation notification for order ${order.orderNumber}`);

    // Prepare email content for manager
    const emailSubject = `Manager Reply Confirmed: ${order.orderNumber}`;
    const emailHtmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">✅ Manager Reply Confirmed</h2>
        <p>Dear Manager,</p>
        
        <p>The branch user has confirmed your reply for the raised issue on order ${order.orderNumber}.</p>
        
        <h3>Order Details:</h3>
        <ul>
          <li><strong>Order Number:</strong> ${order.orderNumber}</li>
          <li><strong>Branch:</strong> ${order.branch.name}</li>
          <li><strong>Requester:</strong> ${order.requester.firstName} ${order.requester.lastName}</li>
          <li><strong>Total Items:</strong> ${order.totalItems}</li>
          <li><strong>Order Value:</strong> ₹${order.totalValue ? order.totalValue.toFixed(2) : '0.00'}</li>
        </ul>

        <p>The order is now ready for status updates (Under Packaging → In Transit).</p>
        
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px;">
          This is an automated notification. Please do not reply to this email.
        </p>
      </div>
    `;

    // Prepare WhatsApp message for manager
    const whatsAppMessage = `✅ *Manager Reply Confirmed: ${order.orderNumber}*

Dear Manager,

The branch user has confirmed your reply for the raised issue on order ${order.orderNumber}.

📦 *Order Details:*
• Order: ${order.orderNumber}
• Branch: ${order.branch.name}
• Requester: ${order.requester.firstName} ${order.requester.lastName}
• Items: ${order.totalItems}
• Value: ₹${order.totalValue ? order.totalValue.toFixed(2) : '0.00'}

The order is now ready for status updates (Under Packaging → In Transit).

Thank you! 🚀`;

    // Send notifications to manager
    const [emailResult, whatsAppResult] = await Promise.all([
      sendEmailNotification(order.manager?.email || 'manager@example.com', emailSubject, emailHtmlContent),
      sendWhatsAppNotification(order.manager?.phoneNumber || process.env.SMARTWHAP_TEST_NUMBER, whatsAppMessage) // use manager phoneNumber or fallback
    ]);

    return {
      success: true,
      message: 'Manager reply confirmation notifications sent',
      emailResult,
      whatsAppResult
    };

  } catch (error) {
    console.error('❌ Manager reply confirmation notification failed:', error);
    return {
      success: false,
      message: 'Failed to send manager reply confirmation notifications',
      error: error.message
    };
  }
};

/**
 * Notify users who have pending orders containing a SKU when it comes back in stock
 * @param {string} sku
 */
const notifyItemBackInStock = async (sku) => {
  try {
    if (!sku) return { success: false, message: 'Missing SKU' };

    const orderItems = await prisma.orderItem.findMany({
      where: {
        sku,
        order: {
          status: { not: 'CLOSED_ORDER' }
        }
      },
      include: {
        order: { select: { id: true, requesterId: true, orderNumber: true } }
      }
    });

    if (!orderItems || orderItems.length === 0) return { success: true, message: 'No pending orders for this SKU' };

    const notified = new Set();
    for (const oi of orderItems) {
      const requesterId = oi.order.requesterId;
      if (!requesterId || notified.has(requesterId)) continue;
      notified.add(requesterId);

      await prisma.notification.create({
        data: {
          type: 'NOTIFY_OUT_OF_STOCK_AVAILABLE',
          title: 'Item Back In Stock',
          message: `Item with SKU ${sku} is now available in stock. Please review your pending order ${oi.order.orderNumber}.`,
          userId: requesterId,
          orderId: oi.order.id
        }
      });
    }

    return { success: true, message: 'Notifications created' };
  } catch (error) {
    console.error('❌ notifyItemBackInStock error:', error);
    return { success: false, message: error.message };
  }
};

/**
 * Send manager notification for new order creation
 * @param {Object} order - Order object with requester, branch, and orderItems
 * @param {Object} manager - Manager object with id, firstName, lastName, email
 * @returns {Object} Result of sending notifications
 */
const sendOrderCreatedNotificationToManager = async (order, manager) => {
  try {
    // Validate required data
    if (!order || !manager || !manager.email) {
      console.warn('Missing required data for manager notification:', { orderId: order?.id, managerId: manager?.id });
      return { success: false, message: 'Missing required data' };
    }

    console.log(`📬 Sending order created notification to manager ${manager.firstName} for order ${order.orderNumber}`);

    const companyName = 'Mystery Rooms';
    const appUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const orderReviewUrl = `${appUrl}`;

    // Determine priority (default to Medium if not specified)
    const priority = order.priority || 'Medium';

    // Email subject
    const emailSubject = `New Stock/Order Request – Approval Required [Order #${order.orderNumber}]`;

    // Email HTML content - Colorful format like requester email
    const emailHtmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
        <div style="background-color: #2563eb; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">📋 New Stock/Order Request Submitted</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px;">Action Required - Manager Review</p>
        </div>
        
        <div style="padding: 30px; background-color: white; margin: 20px;">
          <p style="color: #111827; font-size: 16px;">Hi ${manager.firstName},</p>
          
          <p style="color: #374151; line-height: 1.6;">
            A new stock / purchase order request has been submitted by <strong>${order.requester.firstName} ${order.requester.lastName}</strong> and requires your immediate review and approval.
          </p>

          <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <table style="width: 100%; color: #374151;">
              <tr style="border-bottom: 1px solid #bfdbfe;">
                <td style="padding: 12px 0; font-weight: bold; width: 45%;">Order ID:</td>
                <td style="padding: 12px 0; color: #2563eb; font-weight: bold; font-size: 16px;">${order.orderNumber}</td>
              </tr>
              <tr style="border-bottom: 1px solid #bfdbfe;">
                <td style="padding: 12px 0; font-weight: bold;">Requested By:</td>
                <td style="padding: 12px 0;">${order.requester.firstName} ${order.requester.lastName}</td>
              </tr>
              <tr style="border-bottom: 1px solid #bfdbfe;">
                <td style="padding: 12px 0; font-weight: bold;">Branch / Location:</td>
                <td style="padding: 12px 0;">${order.branch.name}</td>
              </tr>

              <tr style="border-bottom: 1px solid #bfdbfe;">
                <td style="padding: 12px 0; font-weight: bold;">Submitted On:</td>
                <td style="padding: 12px 0;">${new Date(order.requestedAt).toLocaleString('en-IN')}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; font-weight: bold;">Status:</td>
                <td style="padding: 12px 0;">
                  <span style="background-color: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold;">Pending Review</span>
                </td>
              </tr>
            </table>
          </div>

          <div style="background-color: #f0fdf4; border-left: 4px solid #059669; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #15803d; margin-top: 0;">📦 Order Summary</h3>
            <table style="width: 100%; color: #374151; font-size: 14px;">
              <tr>
                <td style="padding: 8px 0;"><strong>Total Items:</strong></td>
                <td style="padding: 8px 0;">${order.totalItems}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Estimated Value:</strong></td>
                <td style="padding: 8px 0; color: #111827; font-weight: 600;">₹${order.totalValue ? order.totalValue.toFixed(2) : '0.00'}</td>
              </tr>
            </table>
          </div>

          ${order.orderItems && order.orderItems.length > 0 ? `
            <h3 style="color: #111827; margin-top: 30px;">📦 Order Summary</h3>
            <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 15px; margin: 15px 0; border-radius: 4px;">
              <p style="color: #0c4a6e; margin: 0;"><strong>${order.totalItems}</strong> items requested in this order</p>
            </div>
          ` : ''}

          ${order.remarks ? `
            <div style="background-color: #f3f4f6; border-left: 4px solid #6b7280; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <h3 style="color: #374151; margin-top: 0;">📝 Reason / Requirement</h3>
              <p style="color: #4b5563; margin: 0; line-height: 1.6;">${order.remarks}</p>
            </div>
          ` : ''}

          <div style="background-color: #fef3c7; border-left: 4px solid #eab308; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #713f12; margin-top: 0;">⚡ Action Required</h3>
            <p style="color: #713f12; margin: 10px 0; line-height: 1.6;">
              Please review the order details above and take one of the following actions:
            </p>
            <ul style="color: #713f12; margin: 10px 0; padding-left: 20px;">
              <li style="margin: 8px 0;">✅ <strong>Approve</strong> - Confirm the order for procurement</li>
              <li style="margin: 8px 0;">🔄 <strong>Ask for Revision</strong> - Request changes or clarification</li>
            </ul>
            <p style="color: #713f12; margin: 10px 0; line-height: 1.6; font-weight: bold;">
              Please respond at your earliest convenience to avoid delays.
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${orderReviewUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; transition: background-color 0.3s ease;">
              📱 Review & Approve Order
            </a>
            <p style="color: #6b7280; font-size: 12px; margin-top: 10px;">
              Click the button above to review and take action
            </p>
          </div>

          <p style="color: #6b7280; margin-top: 30px; line-height: 1.6;">
            Thank you for your prompt attention to this order request.
          </p>

          <div style="background-color: #f3f4f6; padding: 15px; margin-top: 30px; border-radius: 4px; text-align: center;">
            <p style="color: #6b7280; margin: 0; font-size: 11px;">
              <strong>${companyName}</strong><br>
              Inventory & Procurement System<br>
              <strong>Order Reference:</strong> ${order.id}
            </p>
          </div>
        </div>

        <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">
            This is an automated notification from your inventory management system.<br>
            Please use the order review link above to approve or reject this request.
          </p>
        </div>
      </div>
    `;

    // Prepare WhatsApp message for manager
    const whatsAppMessage = `📋 *New Stock/Order Request – Action Required*

Dear ${manager.firstName},

A new stock/order request has been submitted by ${order.requester.firstName} ${order.requester.lastName} and requires your immediate review.

*📦 Order Details:*
• Order ID: ${order.orderNumber}
• Branch: ${order.branch.name}
• Priority: ${priority}
• Total Items: ${order.totalItems}
• Estimated Value: ₹${order.totalValue ? order.totalValue.toFixed(2) : '0.00'}

${order.remarks ? `*📝 Reason/Requirement:*
${order.remarks}` : ''}

⚡ *Action Required:*
Please Approve / Reject / Ask for Revision at your earliest convenience.

🔗 Review Order: ${orderReviewUrl}

Thank you,
${companyName}`;

    // Send email to manager
    const emailResult = await sendEmailNotification(
      manager.email,
      emailSubject,
      emailHtmlContent
    );

    // Send WhatsApp if phone number available
    let whatsAppResult = { success: false, message: 'No phone number' };
    if (manager.phoneNumber) {
      whatsAppResult = await sendWhatsAppNotification(
        manager.phoneNumber,
        whatsAppMessage
      );
    }

    return {
      success: emailResult.success,
      email: emailResult,
      whatsApp: whatsAppResult,
      message: 'Manager notification sent'
    };
  } catch (error) {
    console.error('❌ Send order created notification to manager error:', error);
    return {
      success: false,
      message: 'Failed to send manager notification',
      error: error.message
    };
  }
};

/**
 * Send order creation notification with formatted email
 * @param {Object} order - Order object with requester, branch, and orderItems
 * @returns {Object} Result of sending notifications
 */
const sendOrderCreatedNotification = async (order) => {
  try {
    // Validate required data
    if (!order || !order.requester || !order.requester.email || !order.branch) {
      console.warn('Missing required data for order notification:', { orderId: order?.id, requesterEmail: order?.requester?.email });
      return { success: false, message: 'Missing required data' };
    }

    console.log(`📬 Sending order created notification for order ${order.orderNumber}`);

    // Get app URL from environment or use default
    const appUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const orderDetailsUrl = `${appUrl}`;
    const companyName = 'Mystery Rooms';

    // Email subject
    const emailSubject = `Stock/Order Request Successfully Created – Pending Manager Approval [Order #${order.orderNumber}]`;
    
    const emailHtmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
        <div style="background-color: #059669; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">✅ Stock/Order Request Successfully Created</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px;">Pending Manager Review</p>
        </div>
        
        <div style="padding: 30px; background-color: white; margin: 20px;">
          <p style="color: #111827; font-size: 16px;">Hi ${order.requester.firstName},</p>
          
          <p style="color: #374151; line-height: 1.6;">
            Your stock / purchase order request has been successfully submitted and is now pending manager review.
          </p>

          <p style="color: #374151; line-height: 1.6;">
            Below are the request details for your reference:
          </p>

          <div style="background-color: #ecfdf5; border-left: 4px solid #059669; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <table style="width: 100%; color: #374151;">
              <tr style="border-bottom: 1px solid #d1fae5;">
                <td style="padding: 12px 0; font-weight: bold; width: 45%;">Order ID:</td>
                <td style="padding: 12px 0; color: #059669; font-weight: bold; font-size: 16px;">${order.orderNumber}</td>
              </tr>
              <tr style="border-bottom: 1px solid #d1fae5;">
                <td style="padding: 12px 0; font-weight: bold;">Location / Branch:</td>
                <td style="padding: 12px 0;">${order.branch.name}</td>
              </tr>
              <tr style="border-bottom: 1px solid #d1fae5;">
                <td style="padding: 12px 0; font-weight: bold;">Submitted On:</td>
                <td style="padding: 12px 0;">${new Date(order.requestedAt).toLocaleString('en-IN')}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; font-weight: bold;">Current Status:</td>
                <td style="padding: 12px 0;">
                  <span style="background-color: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold;">Pending Approval</span>
                </td>
              </tr>
            </table>
          </div>

          <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #0c4a6e; margin-top: 0;">📦 Order Summary</h3>
            <table style="width: 100%; color: #374151; font-size: 14px;">
              <tr>
                <td style="padding: 8px 0;"><strong>Total Items:</strong></td>
                <td style="padding: 8px 0;">${order.totalItems}</td>
              </tr>
            </table>
          </div>

          ${order.orderItems && order.orderItems.length > 0 ? `
            <h3 style="color: #111827; margin-top: 30px;">📦 Order Summary</h3>
            <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 15px; margin: 15px 0; border-radius: 4px;">
              <p style="color: #0c4a6e; margin: 0;"><strong>${order.totalItems}</strong> items requested in this order</p>
            </div>
          ` : ''}

          <div style="text-align: center; margin: 30px 0;">
            <a href="${orderDetailsUrl}" style="display: inline-block; background-color: #059669; color: white; padding: 12px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; transition: background-color 0.3s ease;">
              📱 View Order Details
            </a>
            <p style="color: #6b7280; font-size: 12px; margin-top: 10px;">
              Click the button above to view complete order details
            </p>
          </div>

          <div style="background-color: #fef3c7; border-left: 4px solid #eab308; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #713f12; margin-top: 0;">⏳ Next Steps</h3>
            <p style="color: #713f12; margin: 0; line-height: 1.6;">
              Our team will notify you as soon as the request is <strong>Approved / Rejected / Requires Update</strong>.
            </p>
          </div>

          ${order.remarks ? `
            <div style="background-color: #f3f4f6; border-left: 4px solid #6b7280; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <h3 style="color: #374151; margin-top: 0;">📝 Additional Notes</h3>
              <p style="color: #4b5563; margin: 0; line-height: 1.6;">${order.remarks}</p>
            </div>
          ` : ''}

          <p style="color: #6b7280; margin-top: 30px; line-height: 1.6;">
            Thank you for using our inventory management system. We appreciate your business!
          </p>

          <div style="background-color: #f3f4f6; padding: 15px; margin-top: 30px; border-radius: 4px; text-align: center;">
            <p style="color: #6b7280; margin: 0; font-size: 11px;">
              <strong>${companyName}</strong><br>
              Inventory & Procurement System<br>
              <strong>Order Reference:</strong> ${order.id}
            </p>
          </div>
        </div>

        <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">
            This is an automated notification from your inventory management system.<br>
            Please do not reply to this email directly. Use the order details link above for updates.
          </p>
        </div>
      </div>
    `;

    // Prepare WhatsApp message
    const whatsAppMessage = `✅ *Stock/Order Request Successfully Created*

Hi ${order.requester.firstName},

Your stock/order request has been successfully submitted and is now pending manager review.

*Request Details:*
📌 Order ID: ${order.orderNumber}
📍 Branch: ${order.branch.name}
📅 Submitted On: ${new Date(order.requestedAt).toLocaleString('en-IN')}
⏳ Status: Pending Approval

*Summary:*
• Total Items: ${order.totalItems}

Our team will notify you once the request is Approved/Rejected/Requires Update.

🔗 View Details: ${orderDetailsUrl}

Thank you,
${companyName}`;

    // Send email to requester
    const emailResult = await sendEmailNotification(
      order.requester.email,
      emailSubject,
      emailHtmlContent
    );

    // Send WhatsApp if phone number available
    let whatsAppResult = { success: false, message: 'No phone number' };
    if (order.requester.phoneNumber) {
      whatsAppResult = await sendWhatsAppNotification(
        order.requester.phoneNumber,
        whatsAppMessage
      );
    }

    return {
      success: emailResult.success,
      email: emailResult,
      whatsApp: whatsAppResult,
      message: 'Order creation notifications sent'
    };
  } catch (error) {
    console.error('❌ Send order created notification error:', error);
    return {
      success: false,
      message: 'Failed to send order creation notifications',
      error: error.message
    };
  }
};

/**
 * Send notification and email to requester after manager updates an order
 * @param {Object} order - Order object with all details
 * @param {Object} manager - Manager object with name, remarks
 * @returns {Object} Result of the notification operation
 */
const sendOrderUpdatedByManagerNotification = async (order, manager) => {
  try {
    console.log(`📬 Sending order updated by manager notification for order ${order.orderNumber}`);

    const companyName = 'Mystery Rooms';
    const appUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

    // ===== EMAIL FOR REQUESTER (USER WHO ORDERED) =====
    const requesterSubject = `Order Updated by Manager – Confirmation Required (Order ID: ${order.orderNumber})`;
    const requesterHtmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
        <div style="background-color: #2563eb; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">📝 Order Updated by Manager – Confirmation Required</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px;">Order ID: ${order.orderNumber}</p>
        </div>
        <div style="padding: 30px; background-color: white; margin: 20px;">
          <p style="color: #111827; font-size: 16px;">Hi ${order.requester.firstName},</p>
          <p style="color: #374151; line-height: 1.6;">
            Your stock / purchase order request has been <strong>updated by ${manager.firstName} ${manager.lastName}</strong>.<br/>
            Please review the revised details below:
          </p>
          <div style="background-color: #f3f4f6; border-left: 4px solid #2563eb; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <table style="width: 100%; color: #374151;">
              <tr style="border-bottom: 1px solid #bfdbfe;">
                <td style="padding: 12px 0; font-weight: bold; width: 45%;">Order ID:</td>
                <td style="padding: 12px 0; color: #2563eb; font-weight: bold; font-size: 16px;">${order.orderNumber}</td>
              </tr>
              <tr style="border-bottom: 1px solid #bfdbfe;">
                <td style="padding: 12px 0; font-weight: bold;">Original Request Date:</td>
                <td style="padding: 12px 0;">${new Date(order.requestedAt).toLocaleString('en-IN')}</td>
              </tr>
              <tr style="border-bottom: 1px solid #bfdbfe;">
                <td style="padding: 12px 0; font-weight: bold;">Location / Branch:</td>
                <td style="padding: 12px 0;">${order.branch.name}</td>
              </tr>
            </table>
          </div>
          <div style="background-color: #fef3c7; border-left: 4px solid #eab308; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #713f12; margin-top: 0;">🔄 Updated Order Details</h3>
            <p style="color: #713f12; margin: 10px 0; line-height: 1.6; font-weight: bold;">Remarks / Reason for Change:</p>
            <p style="color: #374151; margin: 0 0 10px 0;">${manager.remarks || ''}</p>
          </div>
          <div style="background-color: #f3f4f6; border-left: 4px solid #2563eb; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #2563eb; margin-top: 0;">📦 Order Summary</h3>
            <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 15px; margin: 15px 0; border-radius: 4px;">
              <p style="color: #0c4a6e; margin: 0;"><strong>${order.totalItems}</strong> items in this order</p>
            </div>
          </div>
          <div style="background-color: #fef3c7; border-left: 4px solid #eab308; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #713f12; margin-top: 0;">⚠️ Action Required</h3>
            <p style="color: #713f12; margin: 10px 0; line-height: 1.6;">
              Kindly review and Confirm whether you accept these changes so that the request can proceed further.<br/>
              Please reply with one of the responses below:
            </p>
            <ul style="color: #713f12; margin: 10px 0; padding-left: 20px;">
              <li style="margin: 8px 0;"><strong>✅ Confirmed –</strong> Proceed with the revised request</li>
              <li style="margin: 8px 0;"><strong>❌ Raise Issue –</strong> Needs correction / revert</li>
            </ul>
          </div>
          <p style="color: #6b7280; margin-top: 30px; line-height: 1.6;">
            If you have any concerns, feel free to reply to this email.<br/>
            Thank you!
          </p>
          <div style="background-color: #f3f4f6; padding: 15px; margin-top: 30px; border-radius: 4px; text-align: center;">
            <p style="color: #6b7280; margin: 0; font-size: 11px;">
              <strong>${companyName}</strong><br>
              Inventory & Procurement System<br>
              <strong>Order Reference:</strong> ${order.id}
            </p>
          </div>
        </div>
        <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">
            This is an automated notification from your inventory management system.<br>
            Please use the system to confirm or raise issues regarding this order.
          </p>
        </div>
      </div>
    `;

    // ===== EMAIL FOR MANAGER =====
    const managerSubject = `Order Successfully Updated – Pending Requester Confirmation (Order ID: ${order.orderNumber})`;
    const managerHtmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
        <div style="background-color: #10b981; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">✅ Order Successfully Updated</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px;">Pending Requester Confirmation</p>
        </div>
        <div style="padding: 30px; background-color: white; margin: 20px;">
          <p style="color: #111827; font-size: 16px;">Dear ${manager.firstName},</p>
          <p style="color: #374151; line-height: 1.6;">
            You have successfully <strong>updated the stock / purchase order request</strong>. The updated details have been shared with the requester for confirmation.
          </p>

          <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <table style="width: 100%; color: #374151;">
              <tr style="border-bottom: 1px solid #a7f3d0;">
                <td style="padding: 12px 0; font-weight: bold; width: 45%;">Order ID:</td>
                <td style="padding: 12px 0; color: #10b981; font-weight: bold; font-size: 16px;">${order.orderNumber}</td>
              </tr>
              <tr style="border-bottom: 1px solid #a7f3d0;">
                <td style="padding: 12px 0; font-weight: bold;">Original Request Date:</td>
                <td style="padding: 12px 0;">${new Date(order.requestedAt).toLocaleString('en-IN')}</td>
              </tr>
              <tr style="border-bottom: 1px solid #a7f3d0;">
                <td style="padding: 12px 0; font-weight: bold;">Location / Branch:</td>
                <td style="padding: 12px 0;">${order.branch.name}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; font-weight: bold;">Requested By:</td>
                <td style="padding: 12px 0;">${order.requester.firstName} ${order.requester.lastName}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #fef3c7; border-left: 4px solid #eab308; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #713f12; margin-top: 0;">🔄 Updated Details Submitted</h3>
            <p style="color: #713f12; margin: 10px 0; line-height: 1.6; font-weight: bold;">Remarks / Reason for Update:</p>
            <p style="color: #374151; margin: 0 0 10px 0; font-style: italic;">"${manager.remarks || 'N/A'}"</p>
          </div>

          <div style="background-color: #f3f4f6; border-left: 4px solid #6b7280; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #374151; margin-top: 0;">📊 Current Status</h3>
            <table style="width: 100%; color: #374151;">
              <tr>
                <td style="padding: 10px 0; font-weight: bold;">Status:</td>
                <td style="padding: 10px 0;">
                  <span style="background-color: #fef3c7; color: #92400e; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: bold;">⏳ Pending Requester Confirmation</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold;">Total Items Updated:</td>
                <td style="padding: 10px 0; color: #111827; font-weight: 600;">${order.orderItems.length} items</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #0c4a6e; margin-top: 0;">📋 What Happens Next?</h3>
            <ul style="color: #0c4a6e; margin: 10px 0; padding-left: 20px;">
              <li style="margin: 8px 0;">The requester <strong>${order.requester.firstName} ${order.requester.lastName}</strong> has been notified of the update</li>
              <li style="margin: 8px 0;">They will review and either <strong>Confirm</strong> or <strong>Raise Issue</strong></li>
              <li style="margin: 8px 0;">You will receive a notification once they respond</li>
            </ul>
          </div>

          <p style="color: #6b7280; margin-top: 30px; line-height: 1.6;">
            Thank you for managing orders efficiently! You will be notified once the requester responds so that further processing can continue.
          </p>

          <div style="background-color: #f3f4f6; padding: 15px; margin-top: 30px; border-radius: 4px; text-align: center;">
            <p style="color: #6b7280; margin: 0; font-size: 11px;">
              <strong>${companyName}</strong><br>
              Inventory & Procurement System<br>
              <strong>Order Reference:</strong> ${order.id}
            </p>
          </div>
        </div>
        <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">
            This is an automated notification from your inventory management system.
          </p>
        </div>
      </div>
    `;

    // Send emails to both requester and manager in parallel
    if (!manager) {
      console.warn(`⚠️ Manager object is null/undefined for order ${order.orderNumber}`);
    } else if (!manager.email) {
      console.warn(`⚠️ Manager email is missing for manager ${manager.firstName} (ID: ${manager.id})`);
    } else {
      console.log(`📧 Manager email found: ${manager.email}`);
    }

    const [requesterEmailResult, managerEmailResult] = await Promise.all([
      sendEmailNotification(order.requester.email, requesterSubject, requesterHtmlContent),
      manager && manager.email ? sendEmailNotification(manager.email, managerSubject, managerHtmlContent) : Promise.resolve({ success: false, message: 'No manager or manager email' })
    ]);
    
    if (!requesterEmailResult.success) {
      console.warn(`⚠️ Email failed for requester on order ${order.orderNumber}, but creating in-app notification anyway`);
    } else {
      console.log(`✅ Email sent successfully to requester for order ${order.orderNumber}`);
    }

    if (!managerEmailResult.success) {
      console.warn(`⚠️ Email failed for manager on order ${order.orderNumber}`);
    } else {
      console.log(`✅ Email sent successfully to manager for order ${order.orderNumber}`);
    }

    // Create in-app notification for requester
    const requesterNotification = await prisma.notification.create({
      data: {
        type: 'ORDER_UPDATED_BY_MANAGER',
        title: 'Order Updated by Manager – Confirmation Required',
        message: `Your order ${order.orderNumber} has been updated by the manager. Please review and confirm the changes.`,
        userId: order.requester.id,
        orderId: order.id,
        isRead: false,
        isEmail: requesterEmailResult.success,
      }
    });
    
    console.log(`✅ In-app notification created for requester on order ${order.orderNumber}`);
    
    return { 
      success: requesterEmailResult.success && managerEmailResult.success, 
      requesterEmail: requesterEmailResult, 
      managerEmail: managerEmailResult,
      notification: requesterNotification,
      message: 'Order update notifications sent to both requester and manager'
    };
  } catch (error) {
    console.error('❌ sendOrderUpdatedByManagerNotification failed:', error);
    return { success: false, message: error.message, error: error };
  }
};

/**
 * Send branch confirmation to manager after branch user confirms the order update
 * @param {Object} order - Order object with all details
 * @param {Object} manager - Manager object with name and email
 * @returns {Object} Result of the notification operation
 */
const sendBranchConfirmationToManagerNotification = async (order, manager) => {
  try {
    console.log(`📬 Sending branch confirmation notification to manager for order ${order.orderNumber}`);

    const companyName = 'Mystery Rooms';

    // ===== EMAIL FOR MANAGER =====
    const managerSubject = `Branch Confirmation Received – Proceed with Arrangement & Packaging (Order ID: ${order.orderNumber})`;
    const managerHtmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
        <div style="background-color: #059669; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">✅ Branch Confirmation Received</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px;">Proceed with Arrangement & Packaging</p>
        </div>
        <div style="padding: 30px; background-color: white; margin: 20px;">
          <p style="color: #111827; font-size: 16px;">Dear ${manager.firstName},</p>
          <p style="color: #374151; line-height: 1.6;">
            The branch has confirmed the approved stock / purchase order request.
            Kindly proceed with arranging the required items and initiate packaging / dispatch preparation.
          </p>

          <div style="background-color: #ecfdf5; border-left: 4px solid #059669; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <table style="width: 100%; color: #374151;">
              <tr style="border-bottom: 1px solid #d1fae5;">
                <td style="padding: 12px 0; font-weight: bold; width: 45%;">Order ID:</td>
                <td style="padding: 12px 0; color: #059669; font-weight: bold; font-size: 16px;">${order.orderNumber}</td>
              </tr>
              <tr style="border-bottom: 1px solid #d1fae5;">
                <td style="padding: 12px 0; font-weight: bold;">Request Date:</td>
                <td style="padding: 12px 0;">${new Date(order.requestedAt).toLocaleString('en-IN')}</td>
              </tr>
              <tr style="border-bottom: 1px solid #d1fae5;">
                <td style="padding: 12px 0; font-weight: bold;">Branch / Location:</td>
                <td style="padding: 12px 0;">${order.branch.name}</td>
              </tr>
            </table>
          </div>

          <h3 style="color: #059669; margin-top: 30px;">📦 Final Order Summary</h3>
          <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 15px; margin: 15px 0; border-radius: 4px;">
            <p style="color: #0c4a6e; margin: 0;"><strong>${order.totalItems}</strong> items confirmed and ready for packaging</p>
          </div>

          <div style="background-color: #fef3c7; border-left: 4px solid #eab308; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #713f12; margin-top: 0;">✔ Required Action</h3>
            <ul style="color: #713f12; margin: 10px 0; padding-left: 20px;">
              <li style="margin: 8px 0;">Arrange the confirmed items</li>
              <li style="margin: 8px 0;">Prepare for packaging / dispatch</li>
              <li style="margin: 8px 0;">Update the system once ready</li>
            </ul>
            <p style="color: #713f12; margin: 10px 0 0 0; line-height: 1.6;">
              Please ensure timely update and processing to avoid any delays.
            </p>
          </div>

          <p style="color: #6b7280; margin-top: 30px; line-height: 1.6;">
            Thank you,
          </p>

          <div style="background-color: #f3f4f6; padding: 15px; margin-top: 30px; border-radius: 4px; text-align: center;">
            <p style="color: #6b7280; margin: 0; font-size: 11px;">
              <strong>${companyName}</strong><br>
              Inventory & Procurement System<br>
              <strong>Order Reference:</strong> ${order.id}
            </p>
          </div>
        </div>
        <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">
            This is an automated notification from your inventory management system.
          </p>
        </div>
      </div>
    `;

    // Send email to manager
    const managerEmailResult = await sendEmailNotification(
      manager.email,
      managerSubject,
      managerHtmlContent
    );

    if (!managerEmailResult.success) {
      console.warn(`⚠️ Email failed for manager on order ${order.orderNumber}`);
    } else {
      console.log(`✅ Branch confirmation email sent successfully to manager for order ${order.orderNumber}`);
    }

    return {
      success: managerEmailResult.success,
      managerEmail: managerEmailResult,
      message: 'Branch confirmation notification sent to manager'
    };
  } catch (error) {
    console.error('❌ sendBranchConfirmationToManagerNotification failed:', error);
    return { success: false, message: error.message, error: error };
  }
};


/**
 * Send email to manager when they update/increase order quantities
 * Email confirms that the update was sent to requester for confirmation
 * @param {Object} order - Order object with details
 * @param {Object} manager - Manager object with firstName, lastName, email
 * @param {Object} quantityChanges - Changes made (optional, from manager quantity increase feature)
 * @returns {Object} Result of the notification
 */
const sendOrderUpdatedToRequesterNotification = async (order, manager, quantityChanges = null) => {
  try {
    console.log(`📬 Sending order updated to requester notification for order ${order.orderNumber}`);

    const companyName = 'Mystery Rooms';
    
    // Build the updated details section
    let updatedDetailsSection = '';
    if (quantityChanges && Object.keys(quantityChanges).length > 0) {
      updatedDetailsSection = `
        <h3 style="color: #111827; margin-top: 20px;">📦 Quantity Changes Summary</h3>
        <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 15px; margin: 15px 0; border-radius: 4px;">
          <p style="color: #0c4a6e; margin: 0;"><strong>${Object.keys(quantityChanges).length}</strong> items had quantity changes</p>
        </div>
      `;
    }

    const managerSubject = `Order Successfully Updated – Pending Requester Confirmation [Order #${order.orderNumber}]`;
    const managerHtmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
        <div style="background-color: #10b981; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">✅ Order Successfully Updated</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px;">Requester has been notified for confirmation</p>
        </div>
        
        <div style="padding: 30px; background-color: white; margin: 20px;">
          <p style="color: #111827; font-size: 16px;">Hi ${manager.firstName},</p>
          
          <p style="color: #374151; line-height: 1.6;">
            You have successfully updated the stock / purchase order request. The updated details have been shared with the requester for confirmation.
          </p>

          <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <table style="width: 100%; color: #047857;">
              <tr style="border-bottom: 1px solid #a7f3d0;">
                <td style="padding: 12px 0; font-weight: bold; width: 45%;">Order ID:</td>
                <td style="padding: 12px 0; color: #10b981; font-weight: bold; font-size: 16px;">${order.orderNumber}</td>
              </tr>
              <tr style="border-bottom: 1px solid #a7f3d0;">
                <td style="padding: 12px 0; font-weight: bold;">Original Request Date:</td>
                <td style="padding: 12px 0;">${new Date(order.requestedAt).toLocaleDateString('en-IN')}</td>
              </tr>
              <tr style="border-bottom: 1px solid #a7f3d0;">
                <td style="padding: 12px 0; font-weight: bold;">Location / Branch:</td>
                <td style="padding: 12px 0;">${order.branch?.name || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; font-weight: bold;">Status:</td>
                <td style="padding: 12px 0;">
                  <span style="background-color: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold;">Pending Requester Confirmation</span>
                </td>
              </tr>
            </table>
          </div>

          <div style="background-color: #fef3c7; border-left: 4px solid #eab308; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #713f12; margin-top: 0;">📝 Remarks / Reason for Update</h3>
            <p style="color: #713f12; margin: 10px 0; line-height: 1.6; font-style: italic;">
              ${order.managerReply || order.remarks || '(No specific remarks provided)'}
            </p>
          </div>

          ${updatedDetailsSection}

          <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #0c4a6e; margin-top: 0;">⏳ What Happens Next?</h3>
            <ul style="color: #0c4a6e; margin: 10px 0; padding-left: 20px;">
              <li style="margin: 8px 0;">The requester has been asked to review and either <strong>Confirm</strong> or <strong>Raise Issue</strong></li>
              <li style="margin: 8px 0;">You will be notified once the requester responds</li>
              <li style="margin: 8px 0;">Further processing will continue based on their confirmation</li>
            </ul>
          </div>

          <div style="background-color: #f3f4f6; border-left: 4px solid #6b7280; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #374151; margin-top: 0;">📊 Current Status</h3>
            <p style="color: #374151; margin: 10px 0;"><strong>Status:</strong> Pending Requester Confirmation</p>
            <p style="color: #374151; margin: 10px 0;"><strong>Total Items:</strong> ${order.totalItems || order.orderItems?.length || 'N/A'}</p>
            <p style="color: #374151; margin: 10px 0;"><strong>Updated At:</strong> ${new Date().toLocaleString('en-IN')}</p>
          </div>

          <p style="color: #6b7280; margin-top: 30px; line-height: 1.6;">
            Thank you for managing orders efficiently. You will receive further notifications as the requester responds.
          </p>

          <div style="background-color: #f3f4f6; padding: 15px; margin-top: 30px; border-radius: 4px; text-align: center;">
            <p style="color: #6b7280; margin: 0; font-size: 11px;">
              <strong>${companyName}</strong><br>
              Inventory & Procurement System<br>
              <strong>Order Reference:</strong> ${order.id}
            </p>
          </div>
        </div>

        <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">
            This is an automated notification from your inventory management system.<br>
            Please use the system to manage and track order updates.
          </p>
        </div>
      </div>
    `;

    const managerEmailResult = await sendEmailNotification(
      manager.email,
      managerSubject,
      managerHtmlContent
    );

    if (!managerEmailResult.success) {
      console.warn(`⚠️ Email failed for manager on order ${order.orderNumber}`);
    } else {
      console.log(`✅ Order updated notification email sent successfully to manager for order ${order.orderNumber}`);
    }

    return {
      success: managerEmailResult.success,
      managerEmail: managerEmailResult,
      message: 'Order update confirmation notification sent to manager'
    };
  } catch (error) {
    console.error('❌ sendOrderUpdatedToRequesterNotification failed:', error);
    return { success: false, message: error.message, error: error };
  }
};


/**
 * Send email to manager when branch user raises an issue on the updated order
 * Notifies manager that action is required
 * @param {Object} order - Order object with details
 * @param {Object} manager - Manager object with firstName, lastName, email
 * @param {Object} issue - Issue object with details and remarks from branch user
 * @returns {Object} Result of the notification
 */
const sendBranchIssuePendingManagerActionNotification = async (order, manager, issue) => {
  try {
    console.log(`📬 Sending branch issue notification for order ${order.orderNumber}`);

    const companyName = 'Mystery Rooms';

    const managerSubject = `Issue Raised by Branch – Action Required [Order #${order.orderNumber}]`;
    const managerHtmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
        <div style="background-color: #ef4444; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">⚠️ Issue Raised by Branch</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px;">Manager action required - Order review needed</p>
        </div>
        
        <div style="padding: 30px; background-color: white; margin: 20px;">
          <p style="color: #111827; font-size: 16px;">Hi ${manager.firstName},</p>
          
          <p style="color: #374151; line-height: 1.6;">
            The requester has raised an issue regarding the updated stock / purchase order request. Kindly review and take necessary action.
          </p>

          <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <table style="width: 100%; color: #7f1d1d;">
              <tr style="border-bottom: 1px solid #fca5a5;">
                <td style="padding: 12px 0; font-weight: bold; width: 45%;">Order ID:</td>
                <td style="padding: 12px 0; color: #ef4444; font-weight: bold; font-size: 16px;">${order.orderNumber}</td>
              </tr>
              <tr style="border-bottom: 1px solid #fca5a5;">
                <td style="padding: 12px 0; font-weight: bold;">Original Request Date:</td>
                <td style="padding: 12px 0;">${new Date(order.requestedAt).toLocaleDateString('en-IN')}</td>
              </tr>
              <tr style="border-bottom: 1px solid #fca5a5;">
                <td style="padding: 12px 0; font-weight: bold;">Branch / Location:</td>
                <td style="padding: 12px 0;">${order.branch?.name || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; font-weight: bold;">Status:</td>
                <td style="padding: 12px 0;">
                  <span style="background-color: #fee2e2; color: #991b1b; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold;">Issue Raised – Action Required</span>
                </td>
              </tr>
            </table>
          </div>

          <h3 style="color: #111827; margin-top: 30px;">📦 Order Summary</h3>
          <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 15px; margin: 15px 0; border-radius: 4px;">
            <p style="color: #0c4a6e; margin: 0;"><strong>${order.totalItems}</strong> items in this order</p>
          </div>

          <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #7f1d1d; margin-top: 0;">⚠️ Issue / Concern Raised by Branch</h3>
            <div style="background-color: white; padding: 15px; border-radius: 4px; margin-top: 10px; border-left: 3px solid #ef4444;">
              <p style="color: #374151; margin: 0; line-height: 1.6; white-space: pre-wrap;">
                ${issue?.remarks || issue?.managerReply || order.managerReply || 'No specific details provided'}
              </p>
            </div>
            <p style="color: #7f1d1d; margin: 15px 0 0 0;"><strong>Raised By:</strong> ${order.requester?.firstName || 'Branch User'} ${order.requester?.lastName || ''}</p>
            <p style="color: #7f1d1d; margin: 10px 0;"><strong>Raised At:</strong> ${issue?.createdAt ? new Date(issue.createdAt).toLocaleString('en-IN') : new Date().toLocaleString('en-IN')}</p>
          </div>

          <div style="background-color: #fef3c7; border-left: 4px solid #eab308; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #713f12; margin-top: 0;">📋 Action Required</h3>
            <ol style="color: #713f12; margin: 10px 0; padding-left: 20px;">
              <li style="margin: 8px 0;"><strong>Review the concern</strong> raised by the branch user</li>
              <li style="margin: 8px 0;"><strong>Analyze</strong> the updated order details</li>
              <li style="margin: 8px 0;"><strong>Update / Resolve</strong> the order as per the feedback</li>
              <li style="margin: 8px 0;"><strong>Notify</strong> the branch user with your response</li>
              <li style="margin: 8px 0;"><strong>Proceed</strong> with order processing once resolved</li>
            </ol>
          </div>

          <div style="background-color: #f3f4f6; border-left: 4px solid #6b7280; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #374151; margin-top: 0;">📊 Current Status</h3>
            <p style="color: #374151; margin: 10px 0;"><strong>Order Status:</strong> Issue Raised – Manager Action Required</p>
            <p style="color: #374151; margin: 10px 0;"><strong>Total Items:</strong> ${order.totalItems || order.orderItems?.length || 'N/A'}</p>
            <p style="color: #374151; margin: 10px 0;"><strong>Priority:</strong> <span style="color: #dc2626; font-weight: bold;">HIGH</span></p>
          </div>

          <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #0c4a6e; margin-top: 0;">💡 Recommendation</h3>
            <p style="color: #0c4a6e; margin: 10px 0; line-height: 1.6;">
              Please review the issue carefully and update the order as needed. Communicate with the branch user to understand their concerns and find a mutually agreeable solution for smooth order processing.
            </p>
          </div>

          <p style="color: #6b7280; margin-top: 30px; line-height: 1.6;">
            Kindly review the concern and update / resolve the order so the process can continue smoothly.
          </p>

          <div style="background-color: #f3f4f6; padding: 15px; margin-top: 30px; border-radius: 4px; text-align: center;">
            <p style="color: #6b7280; margin: 0; font-size: 11px;">
              <strong>${companyName}</strong><br>
              Inventory & Procurement System<br>
              <strong>Order Reference:</strong> ${order.id}
            </p>
          </div>
        </div>

        <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">
            This is an automated notification from your inventory management system.<br>
            Please use the system to update and resolve the order.
          </p>
        </div>
      </div>
    `;

    const managerEmailResult = await sendEmailNotification(
      manager.email,
      managerSubject,
      managerHtmlContent
    );

    if (!managerEmailResult.success) {
      console.warn(`⚠️ Email failed for manager on order ${order.orderNumber}`);
    } else {
      console.log(`✅ Branch issue notification email sent successfully to manager for order ${order.orderNumber}`);
    }

    return {
      success: managerEmailResult.success,
      managerEmail: managerEmailResult,
      message: 'Branch issue notification sent to manager - Action required'
    };
  } catch (error) {
    console.error('❌ sendBranchIssuePendingManagerActionNotification failed:', error);
    return { success: false, message: error.message, error: error };
  }
};

/**
 * Send confirmation email to requester when they confirm manager's updates
 * @param {Object} order - Order object with details
 * @returns {Object} Email result
 */
const sendBranchConfirmationReceivedNotification = async (order) => {
  try {
    console.log(`📬 Sending confirmation received notification to requester for order ${order.orderNumber}`);

    const companyName = 'Mystery Rooms';

    // ===== EMAIL FOR REQUESTER =====
    const requesterSubject = `Your Confirmation Received – Order Approved for Processing (Order ID: ${order.orderNumber})`;
    const requesterHtmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
        <div style="background-color: #0284c7; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">✅ Your Confirmation Received</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px;">Order Approved for Processing</p>
        </div>
        <div style="padding: 30px; background-color: white; margin: 20px;">
          <p style="color: #111827; font-size: 16px;">Hi ${order.requester?.firstName || 'there'},</p>
          <p style="color: #374151; line-height: 1.6;">
            Thank you for reviewing the updated stock / purchase order request. Your confirmation has been successfully recorded and the order will now move forward for further processing.
          </p>

          <div style="background-color: #ecfef5; border-left: 4px solid #0284c7; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <table style="width: 100%; color: #374151;">
              <tr style="border-bottom: 1px solid #cffafe;">
                <td style="padding: 12px 0; font-weight: bold; width: 45%;">Order ID:</td>
                <td style="padding: 12px 0; color: #0284c7; font-weight: bold; font-size: 16px;">${order.orderNumber}</td>
              </tr>
              <tr style="border-bottom: 1px solid #cffafe;">
                <td style="padding: 12px 0; font-weight: bold;">Original Request Date:</td>
                <td style="padding: 12px 0;">${new Date(order.requestedAt).toLocaleString('en-IN')}</td>
              </tr>
              <tr style="border-bottom: 1px solid #cffafe;">
                <td style="padding: 12px 0; font-weight: bold;">Branch / Location:</td>
                <td style="padding: 12px 0;">${order.branch?.name || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; font-weight: bold;">Status:</td>
                <td style="padding: 12px 0;">
                  <span style="background-color: #cffafe; color: #0c4a6e; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold;">CONFIRMED</span>
                </td>
              </tr>
            </table>
          </div>

          <h3 style="color: #0284c7; margin-top: 30px;">📋 Approved Order Details</h3>
          <table style="width: 100%; border-collapse: collapse; margin: 15px 0; background-color: #f9fafb; font-size: 14px;">
            <thead>
              <tr style="background-color: #f3f4f6; border-bottom: 2px solid #e5e7eb;">
                <th style="border: 1px solid #e5e7eb; padding: 10px; text-align: left; color: #374151; font-weight: 600;">Item</th>
                <th style="border: 1px solid #e5e7eb; padding: 10px; text-align: center; color: #374151; font-weight: 600;">Quantity</th>
                <th style="border: 1px solid #e5e7eb; padding: 10px; text-align: center; color: #374151; font-weight: 600;">Unit</th>
              </tr>
            </thead>
            <tbody>
              ${order.orderItems.map(item => `
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="border: 1px solid #e5e7eb; padding: 10px; color: #374151;">${item.item?.name || item.itemName || 'Unknown Item'}</td>
                  <td style="border: 1px solid #e5e7eb; padding: 10px; text-align: center; color: #111827; font-weight: 600;">${item.qtyApproved || item.qtyRequested}</td>
                  <td style="border: 1px solid #e5e7eb; padding: 10px; text-align: center; color: #374151;">${item.item?.unit || item.unit || 'units'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="background-color: #f3f4f6; border-left: 4px solid #6b7280; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #374151; margin-top: 0;">📊 Current Status</h3>
            <table style="width: 100%; color: #374151;">
              <tr>
                <td style="padding: 10px 0; font-weight: bold;">Order Status:</td>
                <td style="padding: 10px 0;">
                  <span style="background-color: #cffafe; color: #0c4a6e; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: bold;">✅ Confirmed by Branch – Processing to Continue</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold;">Total Items:</td>
                <td style="padding: 10px 0; color: #111827; font-weight: 600;">${order.orderItems.length} items</td>
              </tr>
            </table>
          </div>

          <p style="color: #6b7280; margin-top: 30px; line-height: 1.6;">
            We will keep you informed on the next status update.
          </p>

          <div style="background-color: #f3f4f6; padding: 15px; margin-top: 30px; border-radius: 4px; text-align: center;">
            <p style="color: #6b7280; margin: 0; font-size: 11px;">
              <strong>${companyName}</strong><br>
              Inventory & Procurement System<br>
              <strong>Order Reference:</strong> ${order.id}
            </p>
          </div>
        </div>
        <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">
            This is an automated notification from your inventory management system.
          </p>
        </div>
      </div>
    `;

    // Send email to requester
    const requesterEmailResult = await sendEmailNotification(
      order.requester?.email || order.requesterEmail,
      requesterSubject,
      requesterHtmlContent
    );

    if (!requesterEmailResult.success) {
      console.warn(`⚠️ Email failed for requester on order ${order.orderNumber}`);
    } else {
      console.log(`✅ Confirmation received email sent successfully to requester for order ${order.orderNumber}`);
    }

    return {
      success: requesterEmailResult.success,
      requesterEmail: requesterEmailResult,
      message: 'Confirmation received notification sent to requester'
    };
  } catch (error) {
    console.error('❌ sendBranchConfirmationReceivedNotification failed:', error);
    return { success: false, message: error.message, error: error };
  }
};

/**
 * Send issue submission email to requester when they raise issue on manager's update
 * @param {Object} order - Order object with details
 * @param {string} issueRemarks - Details of the issue raised
 * @returns {Object} Email result
 */
const sendBranchIssueSubmittedNotification = async (order, issueRemarks) => {
  try {
    console.log(`📬 Sending issue submission notification to requester for order ${order.orderNumber}`);

    const companyName = 'Mystery Rooms';

    // ===== EMAIL FOR REQUESTER =====
    const requesterSubject = `Your Issue Submission Received – Manager Action in Progress (Order ID: ${order.orderNumber})`;
    const requesterHtmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
        <div style="background-color: #f59e0b; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">📋 Your Issue Submission Received</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px;">Manager Action in Progress</p>
        </div>
        <div style="padding: 30px; background-color: white; margin: 20px;">
          <p style="color: #111827; font-size: 16px;">Hi ${order.requester?.firstName || 'there'},</p>
          <p style="color: #374151; line-height: 1.6;">
            We have received your issue / concern regarding the updated stock / purchase order request. The details have been shared with the Manager for review and necessary action.
          </p>

          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <table style="width: 100%; color: #374151;">
              <tr style="border-bottom: 1px solid #fed7aa;">
                <td style="padding: 12px 0; font-weight: bold; width: 45%;">Order ID:</td>
                <td style="padding: 12px 0; color: #f59e0b; font-weight: bold; font-size: 16px;">${order.orderNumber}</td>
              </tr>
              <tr style="border-bottom: 1px solid #fed7aa;">
                <td style="padding: 12px 0; font-weight: bold;">Original Request Date:</td>
                <td style="padding: 12px 0;">${new Date(order.requestedAt).toLocaleString('en-IN')}</td>
              </tr>
              <tr style="border-bottom: 1px solid #fed7aa;">
                <td style="padding: 12px 0; font-weight: bold;">Branch / Location:</td>
                <td style="padding: 12px 0;">${order.branch?.name || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; font-weight: bold;">Status:</td>
                <td style="padding: 12px 0;">
                  <span style="background-color: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold;">ISSUE RAISED</span>
                </td>
              </tr>
            </table>
          </div>

          <h3 style="color: #f59e0b; margin-top: 30px;">📋 Order Details</h3>
          <table style="width: 100%; border-collapse: collapse; margin: 15px 0; background-color: #f9fafb; font-size: 14px;">
            <thead>
              <tr style="background-color: #f3f4f6; border-bottom: 2px solid #e5e7eb;">
                <th style="border: 1px solid #e5e7eb; padding: 10px; text-align: left; color: #374151; font-weight: 600;">Item</th>
                <th style="border: 1px solid #e5e7eb; padding: 10px; text-align: center; color: #374151; font-weight: 600;">Quantity</th>
                <th style="border: 1px solid #e5e7eb; padding: 10px; text-align: center; color: #374151; font-weight: 600;">Unit</th>
              </tr>
            </thead>
            <tbody>
              ${order.orderItems.map(item => `
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="border: 1px solid #e5e7eb; padding: 10px; color: #374151;">${item.item?.name || item.itemName || 'Unknown Item'}</td>
                  <td style="border: 1px solid #e5e7eb; padding: 10px; text-align: center; color: #111827; font-weight: 600;">${item.qtyApproved || item.qtyRequested}</td>
                  <td style="border: 1px solid #e5e7eb; padding: 10px; text-align: center; color: #374151;">${item.item?.unit || item.unit || 'units'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #92400e; margin-top: 0;">⚠️ Issue Submitted</h3>
            <p style="color: #78350f; line-height: 1.6; margin: 10px 0;">
              <strong>Your Concern:</strong><br>
              ${issueRemarks}
            </p>
          </div>

          <div style="background-color: #f3f4f6; border-left: 4px solid #6b7280; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #374151; margin-top: 0;">📊 Current Status</h3>
            <table style="width: 100%; color: #374151;">
              <tr>
                <td style="padding: 10px 0; font-weight: bold;">Order Status:</td>
                <td style="padding: 10px 0;">
                  <span style="background-color: #fef3c7; color: #92400e; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: bold;">⏳ Issue Raised – Awaiting Manager Action</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold;">Action:</td>
                <td style="padding: 10px 0; color: #111827;">Manager review in progress</td>
              </tr>
            </table>
          </div>

          <p style="color: #6b7280; margin-top: 30px; line-height: 1.6;">
            You will receive another update once the Manager reviews and updates the request.
          </p>

          <div style="background-color: #f3f4f6; padding: 15px; margin-top: 30px; border-radius: 4px; text-align: center;">
            <p style="color: #6b7280; margin: 0; font-size: 11px;">
              <strong>${companyName}</strong><br>
              Inventory & Procurement System<br>
              <strong>Order Reference:</strong> ${order.id}
            </p>
          </div>
        </div>
        <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">
            This is an automated notification from your inventory management system.
          </p>
        </div>
      </div>
    `;

    // Send email to requester
    const requesterEmailResult = await sendEmailNotification(
      order.requester?.email || order.requesterEmail,
      requesterSubject,
      requesterHtmlContent
    );

    if (!requesterEmailResult.success) {
      console.warn(`⚠️ Email failed for requester on order ${order.orderNumber}`);
    } else {
      console.log(`✅ Issue submission email sent successfully to requester for order ${order.orderNumber}`);
    }

    return {
      success: requesterEmailResult.success,
      requesterEmail: requesterEmailResult,
      message: 'Issue submission notification sent to requester'
    };
  } catch (error) {
    console.error('❌ sendBranchIssueSubmittedNotification failed:', error);
    return { success: false, message: error.message, error: error };
  }
};

/**
 * Send approval & confirmation email to requester when order is fully approved and ready for processing
 * @param {Object} order - Order object with details
 * @returns {Object} Email result
 */
const sendOrderApprovedConfirmedNotification = async (order) => {
  try {
    console.log(`📬 Sending order approved & confirmed notification to requester for order ${order.orderNumber}`);

    const companyName = 'Mystery Rooms';

    // ===== EMAIL FOR REQUESTER =====
    const requesterSubject = `Order Approved & Confirmed – Processing Initiated (Order ID: ${order.orderNumber})`;
    const requesterHtmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
        <div style="background-color: #059669; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">✅ Order Approved & Confirmed</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px;">Processing Initiated</p>
        </div>
        <div style="padding: 30px; background-color: white; margin: 20px;">
          <p style="color: #111827; font-size: 16px;">Hi ${order.requester?.firstName || 'there'},</p>
          <p style="color: #374151; line-height: 1.6;">
            Good news! Your stock / purchase order request has been <strong>approved by the Manager</strong> and <strong>confirmed by the Branch</strong> without any issues. The order is now moving ahead for further processing.
          </p>

          <div style="background-color: #ecfdf5; border-left: 4px solid #059669; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <table style="width: 100%; color: #374151;">
              <tr style="border-bottom: 1px solid #d1fae5;">
                <td style="padding: 12px 0; font-weight: bold; width: 45%;">Order ID:</td>
                <td style="padding: 12px 0; color: #059669; font-weight: bold; font-size: 16px;">${order.orderNumber}</td>
              </tr>
              <tr style="border-bottom: 1px solid #d1fae5;">
                <td style="padding: 12px 0; font-weight: bold;">Request Date:</td>
                <td style="padding: 12px 0;">${new Date(order.requestedAt).toLocaleString('en-IN')}</td>
              </tr>
              <tr style="border-bottom: 1px solid #d1fae5;">
                <td style="padding: 12px 0; font-weight: bold;">Branch / Location:</td>
                <td style="padding: 12px 0;">${order.branch?.name || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; font-weight: bold;">Status:</td>
                <td style="padding: 12px 0;">
                  <span style="background-color: #dcfce7; color: #166534; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold;">✅ APPROVED & CONFIRMED</span>
                </td>
              </tr>
            </table>
          </div>

          <h3 style="color: #059669; margin-top: 30px;">📋 Final Approved Order Details</h3>
          <table style="width: 100%; border-collapse: collapse; margin: 15px 0; background-color: #f9fafb; font-size: 14px;">
            <thead>
              <tr style="background-color: #f3f4f6; border-bottom: 2px solid #e5e7eb;">
                <th style="border: 1px solid #e5e7eb; padding: 10px; text-align: left; color: #374151; font-weight: 600;">Item(s)</th>
                <th style="border: 1px solid #e5e7eb; padding: 10px; text-align: center; color: #374151; font-weight: 600;">Quantity</th>
                <th style="border: 1px solid #e5e7eb; padding: 10px; text-align: center; color: #374151; font-weight: 600;">Unit</th>
              </tr>
            </thead>
            <tbody>
              ${order.orderItems.map(item => `
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="border: 1px solid #e5e7eb; padding: 10px; color: #374151;">${item.item?.name || item.itemName || 'Unknown Item'}</td>
                  <td style="border: 1px solid #e5e7eb; padding: 10px; text-align: center; color: #111827; font-weight: 600;">${item.qtyApproved || item.qtyRequested}</td>
                  <td style="border: 1px solid #e5e7eb; padding: 10px; text-align: center; color: #374151;">${item.item?.unit || item.unit || 'units'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="background-color: #f3f4f6; border-left: 4px solid #6b7280; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #374151; margin-top: 0;">📊 Current Status</h3>
            <table style="width: 100%; color: #374151;">
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 10px 0; font-weight: bold;">Order Status:</td>
                <td style="padding: 10px 0;">
                  <span style="background-color: #dcfce7; color: #166534; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: bold;">✅ Approved & Confirmed – Processing Initiated</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold;">Next Step:</td>
                <td style="padding: 10px 0; color: #111827;">Order moving to packaging & dispatch</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #0c4a6e; margin-top: 0;">🚀 What Happens Next?</h3>
            <ul style="color: #0c4a6e; margin: 10px 0; padding-left: 20px;">
              <li style="margin: 8px 0;">Order is now <strong>processing</strong></li>
              <li style="margin: 8px 0;">Items will be <strong>arranged and packaged</strong></li>
              <li style="margin: 8px 0;">Once ready, order will be <strong>dispatched</strong> to your branch</li>
              <li style="margin: 8px 0;">You'll receive <strong>tracking updates</strong> via email/WhatsApp</li>
            </ul>
          </div>

          <p style="color: #6b7280; margin-top: 30px; line-height: 1.6;">
            You will receive another update once the order is processed / dispatched or if any action is required from your side.
          </p>

          <div style="background-color: #f3f4f6; padding: 15px; margin-top: 30px; border-radius: 4px; text-align: center;">
            <p style="color: #6b7280; margin: 0; font-size: 11px;">
              <strong>${companyName}</strong><br>
              Inventory & Procurement System<br>
              <strong>Order Reference:</strong> ${order.id}
            </p>
          </div>
        </div>
        <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">
            This is an automated notification from your inventory management system.
          </p>
        </div>
      </div>
    `;

    // Send email to requester
    const requesterEmailResult = await sendEmailNotification(
      order.requester?.email || order.requesterEmail,
      requesterSubject,
      requesterHtmlContent
    );

    if (!requesterEmailResult.success) {
      console.warn(`⚠️ Email failed for requester on order ${order.orderNumber}`);
    } else {
      console.log(`✅ Order approved & confirmed email sent successfully to requester for order ${order.orderNumber}`);
    }

    return {
      success: requesterEmailResult.success,
      requesterEmail: requesterEmailResult,
      message: 'Order approved & confirmed notification sent to requester'
    };
  } catch (error) {
    console.error('❌ sendOrderApprovedConfirmedNotification failed:', error);
    return {
      success: false,
      message: 'Failed to send order approved & confirmed notification',
      error: error.message
    };
  }
};

/**
 * Send packaging assignment notification to packager
 * @param {Object} order - Order object with all details
 * @param {Object} packager - Packager user object
 */
const sendPackagingAssignmentNotification = async (order, packager) => {
  try {
    console.log(`📬 Sending packaging assignment notification for order ${order.orderNumber}`);

    const companyName = 'Mystery Rooms';
    
    // Email subject
    const emailSubject = `New Task Assigned – Please Start Packaging (Order ID: ${order.orderNumber})`;
    
    // Email HTML content
    const emailHtmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
        <div style="background-color: #dc2626; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">📦 New Task Assigned</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px;">Please Start Packaging</p>
        </div>
        <div style="padding: 30px; background-color: white; margin: 20px;">
          <p style="color: #111827; font-size: 16px;">Dear ${packager.firstName} ${packager.lastName} / Packaging Team,</p>
          <p style="color: #374151; line-height: 1.6;">
            A new order has been assigned to you for Packaging. Please begin the packaging process as per the required standards.
          </p>

          <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #7f1d1d; margin-top: 0;">Order Details</h3>
            <table style="width: 100%; color: #374151;">
              <tr style="border-bottom: 1px solid #fecaca;">
                <td style="padding: 12px 0; font-weight: bold; width: 45%;">Order ID:</td>
                <td style="padding: 12px 0; color: #dc2626; font-weight: bold; font-size: 16px;">${order.orderNumber}</td>
              </tr>
              <tr style="border-bottom: 1px solid #fecaca;">
                <td style="padding: 12px 0; font-weight: bold;">Request Date:</td>
                <td style="padding: 12px 0;">${order.requestedAt ? new Date(order.requestedAt).toLocaleString('en-IN') : ''}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; font-weight: bold;">Branch / Location:</td>
                <td style="padding: 12px 0;">${order.branch?.name || ''}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #fff7ed; border-left: 4px solid #ea580c; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #7c2d12; margin-top: 0;">Packaging Instructions</h3>
            <ul style="color: #7c2d12; margin: 10px 0; padding-left: 20px; line-height: 1.6;">
              <li>✔ Ensure all arranged items are properly packed</li>
              <li>✔ Verify quantity & condition before sealing</li>
              <li>✔ Upload photos/videos if required</li>
              <li>✔ Mark Packaging as Completed in the system once done</li>
            </ul>
          </div>

          <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #075985; margin-top: 0;">Current Status</h3>
            <p style="color: #075985; margin: 10px 0; line-height: 1.6; font-weight: bold;">
              Arranging Completed → Packaging In Progress
            </p>
          </div>

          <div style="background-color: #fef3c7; border-left: 4px solid #eab308; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <p style="color: #713f12; margin: 0; line-height: 1.6; font-weight: bold;">
              Kindly proceed at the earliest to avoid any delay.
            </p>
          </div>

          <p style="color: #6b7280; margin-top: 30px; line-height: 1.6;">
            Thank you,
          </p>

          <div style="background-color: #f3f4f6; padding: 15px; margin-top: 30px; border-radius: 4px; text-align: center;">
            <p style="color: #6b7280; margin: 0; font-size: 11px;">
              <strong>${companyName}</strong><br>
              Inventory & Procurement System<br>
              <strong>Order Reference:</strong> ${order.id}
            </p>
          </div>
        </div>
        <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">
            This is an automated notification from your inventory management system.
          </p>
        </div>
      </div>
    `;

    // WhatsApp message
    const whatsAppMessage = `📦 *New Task Assigned – Please Start Packaging: ${order.orderNumber}*

Dear ${packager.firstName} ${packager.lastName} / Packaging Team,

A new order has been assigned to you for Packaging. Please begin the packaging process as per the required standards.

📦 *Order Details:*
• Order: ${order.orderNumber}
• Request Date: ${order.requestedAt ? new Date(order.requestedAt).toLocaleString('en-IN') : ''}
• Branch: ${order.branch?.name}

📋 *Packaging Instructions:*
✔ Ensure all arranged items are properly packed
✔ Verify quantity & condition before sealing
✔ Upload photos/videos if required
✔ Mark Packaging as Completed in the system once done

📊 *Current Status:*
Arranging Completed → Packaging In Progress

Kindly proceed at the earliest to avoid any delay.

Thank you! 🚀`;

    // Send notifications to packager
    const [emailResult, whatsAppResult] = await Promise.all([
      sendEmailNotification(packager.email, emailSubject, emailHtmlContent),
      sendWhatsAppNotification(packager.phoneNumber || process.env.SMARTWHAP_TEST_NUMBER, whatsAppMessage)
    ]);

    return {
      success: true,
      message: 'Packaging assignment notification sent',
      emailResult,
      whatsAppResult
    };

  } catch (error) {
    console.error('❌ Packaging assignment notification failed:', error);
    return {
      success: false,
      message: 'Failed to send packaging assignment notification',
      error: error.message
    };
  }
};

/**
 * Send packaging stage started notification to manager
 * @param {Object} order - Order object with all details
 * @param {Object} manager - Manager user object
 */
const sendPackagingStageStartedNotification = async (order, manager) => {
  try {
    console.log(`📬 Sending packaging stage started notification for order ${order.orderNumber}`);

    const companyName = 'Mystery Rooms';
    
    // Email subject
    const emailSubject = `Order Status Update – Packaging Stage Started (Order ID: ${order.orderNumber})`;
    
    // Email HTML content
    const emailHtmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
        <div style="background-color: #0284c7; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">📦 Packaging Stage Started</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px;">Order Status Update</p>
        </div>
        <div style="padding: 30px; background-color: white; margin: 20px;">
          <p style="color: #111827; font-size: 16px;">Dear ${manager.firstName} ${manager.lastName},</p>
          <p style="color: #374151; line-height: 1.6;">
            This is to update you that the below order has successfully moved to the Packaging Stage.<br/>
            The Packaging Team has been notified and is now working on it.
          </p>

          <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #075985; margin-top: 0;">Order Details</h3>
            <table style="width: 100%; color: #374151;">
              <tr style="border-bottom: 1px solid #bae6fd;">
                <td style="padding: 12px 0; font-weight: bold; width: 45%;">Order ID:</td>
                <td style="padding: 12px 0; color: #0284c7; font-weight: bold; font-size: 16px;">${order.orderNumber}</td>
              </tr>
              <tr style="border-bottom: 1px solid #bae6fd;">
                <td style="padding: 12px 0; font-weight: bold;">Request Date:</td>
                <td style="padding: 12px 0;">${order.requestedAt ? new Date(order.requestedAt).toLocaleString('en-IN') : ''}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; font-weight: bold;">Branch / Location:</td>
                <td style="padding: 12px 0;">${order.branch?.name || ''}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #075985; margin-top: 0;">Current Status Flow</h3>
            <p style="color: #075985; margin: 10px 0; line-height: 1.6; font-weight: bold;">
              Requested → Approved → Branch Confirmed → Arranging Completed → Packaging In Progress
            </p>
          </div>

          <div style="background-color: #ecfdf5; border-left: 4px solid #059669; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <p style="color: #065f46; margin: 0; line-height: 1.6; font-weight: bold;">
              No action is required from your side at this moment.
            </p>
            <p style="color: #065f46; margin: 10px 0 0 0; line-height: 1.6;">
              You will receive another notification once packaging is completed and the order moves to Dispatch / Handover.
            </p>
          </div>

          <p style="color: #6b7280; margin-top: 30px; line-height: 1.6;">
            Thank you,
          </p>

          <div style="background-color: #f3f4f6; padding: 15px; margin-top: 30px; border-radius: 4px; text-align: center;">
            <p style="color: #6b7280; margin: 0; font-size: 11px;">
              <strong>${companyName}</strong><br>
              Inventory & Procurement System<br>
              <strong>Order Reference:</strong> ${order.id}
            </p>
          </div>
        </div>
        <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">
            This is an automated notification from your inventory management system.
          </p>
        </div>
      </div>
    `;

    // WhatsApp message
    const whatsAppMessage = `📦 *Order Status Update – Packaging Stage Started: ${order.orderNumber}*

Dear ${manager.firstName} ${manager.lastName},

This is to update you that the below order has successfully moved to the Packaging Stage. The Packaging Team has been notified and is now working on it.

📦 *Order Details:*
• Order: ${order.orderNumber}
• Request Date: ${order.requestedAt ? new Date(order.requestedAt).toLocaleString('en-IN') : ''}
• Branch: ${order.branch?.name}

📊 *Current Status Flow:*
Requested → Approved → Branch Confirmed → Arranging Completed → Packaging In Progress

No action is required from your side at this moment. You will receive another notification once packaging is completed and the order moves to Dispatch / Handover.

Thank you! 🚀`;

    // Send notifications to manager
    const [emailResult, whatsAppResult] = await Promise.all([
      sendEmailNotification(manager.email, emailSubject, emailHtmlContent),
      sendWhatsAppNotification(manager.phoneNumber || process.env.SMARTWHAP_TEST_NUMBER, whatsAppMessage)
    ]);

    return {
      success: true,
      message: 'Packaging stage started notification sent',
      emailResult,
      whatsAppResult
    };

  } catch (error) {
    console.error('❌ Packaging stage started notification failed:', error);
    return {
      success: false,
      message: 'Failed to send packaging stage started notification',
      error: error.message
    };
  }
};

/**
 * Send packaging in progress notification to packager
 * @param {Object} order - Order object with all details
 * @param {Object} packager - Packager user object
 */
const sendPackagingInProgressNotificationToPackager = async (order, packager) => {
  try {
    console.log(`📬 Sending packaging in progress notification to packager for order ${order.orderNumber}`);

    const companyName = 'Mystery Rooms';
    
    // Email subject
    const emailSubject = `Packaging In Progress – Please Continue (Order ID: ${order.orderNumber})`;
    
    // Email HTML content
    const emailHtmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
        <div style="background-color: #f59e0b; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">📦 Packaging In Progress</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px;">Please Continue</p>
        </div>
        <div style="padding: 30px; background-color: white; margin: 20px;">
          <p style="color: #111827; font-size: 16px;">Dear ${packager.firstName},</p>
          <p style="color: #374151; line-height: 1.6;">
            The order assigned to you is currently under packaging. Please continue preparing the items according to the standard guidelines.
          </p>

          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #713f12; margin-top: 0;">Order Details</h3>
            <table style="width: 100%; color: #374151;">
              <tr style="border-bottom: 1px solid #fde68a;">
                <td style="padding: 12px 0; font-weight: bold; width: 45%;">Order ID:</td>
                <td style="padding: 12px 0; color: #f59e0b; font-weight: bold; font-size: 16px;">${order.orderNumber}</td>
              </tr>
              <tr style="border-bottom: 1px solid #fde68a;">
                <td style="padding: 12px 0; font-weight: bold;">Request Date:</td>
                <td style="padding: 12px 0;">${order.requestedAt ? new Date(order.requestedAt).toLocaleString('en-IN') : ''}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; font-weight: bold;">Branch / Location:</td>
                <td style="padding: 12px 0;">${order.branch?.name || ''}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #075985; margin-top: 0;">Current Status</h3>
            <p style="color: #075985; margin: 10px 0; line-height: 1.6; font-weight: bold;">
              Arranging Completed → Packaging In Progress
            </p>
          </div>

          <div style="background-color: #fff7ed; border-left: 4px solid #ea580c; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #7c2d12; margin-top: 0;">Action Required</h3>
            <ul style="color: #7c2d12; margin: 10px 0; padding-left: 20px; line-height: 1.6;">
              <li>✔ Ensure items are securely packed</li>
              <li>✔ Verify all quantities and conditions</li>
              <li>✔ Update the system once packaging is complete</li>
              <li>✔ Upload Photos / Videos if necessary</li>
            </ul>
          </div>

          <p style="color: #6b7280; margin-top: 30px; line-height: 1.6;">
            Thank you,
          </p>

          <div style="background-color: #f3f4f6; padding: 15px; margin-top: 30px; border-radius: 4px; text-align: center;">
            <p style="color: #6b7280; margin: 0; font-size: 11px;">
              <strong>${companyName}</strong><br>
              Inventory & Procurement System<br>
              <strong>Order Reference:</strong> ${order.id}
            </p>
          </div>
        </div>
        <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">
            This is an automated notification from your inventory management system.
          </p>
        </div>
      </div>
    `;

    // WhatsApp message
    const whatsAppMessage = `📦 *Packaging In Progress – Please Continue: ${order.orderNumber}*

Dear ${packager.firstName},

The order assigned to you is currently under packaging. Please continue preparing the items according to the standard guidelines.

📦 *Order Details:*
• Order: ${order.orderNumber}
• Request Date: ${order.requestedAt ? new Date(order.requestedAt).toLocaleString('en-IN') : ''}
• Branch: ${order.branch?.name}

📊 *Current Status:*
Arranging Completed → Packaging In Progress

📋 *Action Required:*
✔ Ensure items are securely packed
✔ Verify all quantities and conditions
✔ Update the system once packaging is complete
✔ Upload Photos / Videos if necessary

Thank you! 🚀`;

    // Send notifications to packager
    const [emailResult, whatsAppResult] = await Promise.all([
      sendEmailNotification(packager.email, emailSubject, emailHtmlContent),
      sendWhatsAppNotification(packager.phoneNumber || process.env.SMARTWHAP_TEST_NUMBER, whatsAppMessage)
    ]);

    return {
      success: true,
      message: 'Packaging in progress notification sent to packager',
      emailResult,
      whatsAppResult
    };

  } catch (error) {
    console.error('❌ Packaging in progress notification to packager failed:', error);
    return {
      success: false,
      message: 'Failed to send packaging in progress notification to packager',
      error: error.message
    };
  }
};

/**
 * Send packaging in progress notification to manager
 * @param {Object} order - Order object with all details
 * @param {Object} manager - Manager user object
 */
const sendPackagingInProgressNotificationToManager = async (order, manager) => {
  try {
    console.log(`📬 Sending packaging in progress notification to manager for order ${order.orderNumber}`);

    const companyName = 'Mystery Rooms';
    
    // Email subject
    const emailSubject = `Order Packaging In Progress (Order ID: ${order.orderNumber})`;
    
    // Email HTML content
    const emailHtmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
        <div style="background-color: #f59e0b; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">📦 Order Packaging In Progress</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px;">Status Update</p>
        </div>
        <div style="padding: 30px; background-color: white; margin: 20px;">
          <p style="color: #111827; font-size: 16px;">Dear ${manager.firstName} ${manager.lastName},</p>
          <p style="color: #374151; line-height: 1.6;">
            The Packaging Team has started processing the order. The order is currently under packaging / being prepared.
          </p>

          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #713f12; margin-top: 0;">Order Details</h3>
            <table style="width: 100%; color: #374151;">
              <tr style="border-bottom: 1px solid #fde68a;">
                <td style="padding: 12px 0; font-weight: bold; width: 45%;">Order ID:</td>
                <td style="padding: 12px 0; color: #f59e0b; font-weight: bold; font-size: 16px;">${order.orderNumber}</td>
              </tr>
              <tr style="border-bottom: 1px solid #fde68a;">
                <td style="padding: 12px 0; font-weight: bold;">Request Date:</td>
                <td style="padding: 12px 0;">${order.requestedAt ? new Date(order.requestedAt).toLocaleString('en-IN') : ''}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; font-weight: bold;">Branch / Location:</td>
                <td style="padding: 12px 0;">${order.branch?.name || ''}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #075985; margin-top: 0;">Current Status Flow</h3>
            <p style="color: #075985; margin: 10px 0; line-height: 1.6; font-weight: bold;">
              Requested → Approved → Branch Confirmed → Arranging Completed → Packaging In Progress
            </p>
          </div>

          <div style="background-color: #ecfdf5; border-left: 4px solid #059669; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <p style="color: #065f46; margin: 0; line-height: 1.6; font-weight: bold;">
              No action is required from your side at this stage.
            </p>
            <p style="color: #065f46; margin: 10px 0 0 0; line-height: 1.6;">
              You will be notified once packaging is completed and the order is ready for dispatch.
            </p>
          </div>

          <p style="color: #6b7280; margin-top: 30px; line-height: 1.6;">
            Thank you,
          </p>

          <div style="background-color: #f3f4f6; padding: 15px; margin-top: 30px; border-radius: 4px; text-align: center;">
            <p style="color: #6b7280; margin: 0; font-size: 11px;">
              <strong>${companyName}</strong><br>
              Inventory & Procurement System<br>
              <strong>Order Reference:</strong> ${order.id}
            </p>
          </div>
        </div>
        <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">
            This is an automated notification from your inventory management system.
          </p>
        </div>
      </div>
    `;

    // WhatsApp message
    const whatsAppMessage = `📦 *Order Packaging In Progress: ${order.orderNumber}*

Dear ${manager.firstName} ${manager.lastName},

The Packaging Team has started processing the order. The order is currently under packaging / being prepared.

📦 *Order Details:*
• Order: ${order.orderNumber}
• Request Date: ${order.requestedAt ? new Date(order.requestedAt).toLocaleString('en-IN') : ''}
• Branch: ${order.branch?.name}

📊 *Current Status Flow:*
Requested → Approved → Branch Confirmed → Arranging Completed → Packaging In Progress

No action is required from your side at this stage. You will be notified once packaging is completed and the order is ready for dispatch.

Thank you! 🚀`;

    // Send notifications to manager
    const [emailResult, whatsAppResult] = await Promise.all([
      sendEmailNotification(manager.email, emailSubject, emailHtmlContent),
      sendWhatsAppNotification(manager.phoneNumber || process.env.SMARTWHAP_TEST_NUMBER, whatsAppMessage)
    ]);

    return {
      success: true,
      message: 'Packaging in progress notification sent to manager',
      emailResult,
      whatsAppResult
    };

  } catch (error) {
    console.error('❌ Packaging in progress notification to manager failed:', error);
    return {
      success: false,
      message: 'Failed to send packaging in progress notification to manager',
      error: error.message
    };
  }
};

/**
 * Send packaging completed notification to packager
 * @param {Object} order - Order object with all details
 * @param {Object} packager - Packager user object
 */
const sendPackagingCompletedNotificationToPackager = async (order, packager) => {
  try {
    console.log(`📬 Sending packaging completed notification to packager for order ${order.orderNumber}`);

    const companyName = 'Mystery Rooms';
    
    // Email subject
    const emailSubject = `Packaging Completed – Mark Order Ready for Dispatch (Order ID: ${order.orderNumber})`;
    
    // Email HTML content
    const emailHtmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
        <div style="background-color: #059669; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">✅ Packaging Completed</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px;">Mark Order Ready for Dispatch</p>
        </div>
        <div style="padding: 30px; background-color: white; margin: 20px;">
          <p style="color: #111827; font-size: 16px;">Dear ${packager.firstName},</p>
          <p style="color: #374151; line-height: 1.6;">
            The packaging for the assigned order has been successfully completed.<br/>
            Please ensure all items are ready and update the system to move the order to the Dispatch Stage.
          </p>

          <div style="background-color: #ecfdf5; border-left: 4px solid #059669; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #065f46; margin-top: 0;">Order Details</h3>
            <table style="width: 100%; color: #374151;">
              <tr style="border-bottom: 1px solid #a7f3d0;">
                <td style="padding: 12px 0; font-weight: bold; width: 45%;">Order ID:</td>
                <td style="padding: 12px 0; color: #059669; font-weight: bold; font-size: 16px;">${order.orderNumber}</td>
              </tr>
              <tr style="border-bottom: 1px solid #a7f3d0;">
                <td style="padding: 12px 0; font-weight: bold;">Request Date:</td>
                <td style="padding: 12px 0;">${order.requestedAt ? new Date(order.requestedAt).toLocaleString('en-IN') : ''}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; font-weight: bold;">Branch / Location:</td>
                <td style="padding: 12px 0;">${order.branch?.name || ''}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #075985; margin-top: 0;">Current Status Flow</h3>
            <p style="color: #075985; margin: 10px 0; line-height: 1.6; font-weight: bold;">
              Arranging Completed → Packaging Completed → Ready for Dispatch
            </p>
          </div>

          <div style="background-color: #fff7ed; border-left: 4px solid #ea580c; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #7c2d12; margin-top: 0;">Action Required</h3>
            <ul style="color: #7c2d12; margin: 10px 0; padding-left: 20px; line-height: 1.6;">
              <li>✔ Confirm all items are packed</li>
              <li>✔ Mark order as Packaging Completed / Ready for Dispatch in the system</li>
              <li>✔ Upload Photos / Videos if required</li>
            </ul>
          </div>

          <p style="color: #6b7280; margin-top: 30px; line-height: 1.6;">
            Thank you,
          </p>

          <div style="background-color: #f3f4f6; padding: 15px; margin-top: 30px; border-radius: 4px; text-align: center;">
            <p style="color: #6b7280; margin: 0; font-size: 11px;">
              <strong>${companyName}</strong><br>
              Inventory & Procurement System<br>
              <strong>Order Reference:</strong> ${order.id}
            </p>
          </div>
        </div>
        <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">
            This is an automated notification from your inventory management system.
          </p>
        </div>
      </div>
    `;

    // WhatsApp message
    const whatsAppMessage = `✅ *Packaging Completed – Mark Order Ready for Dispatch: ${order.orderNumber}*

Dear ${packager.firstName},

The packaging for the assigned order has been successfully completed. Please ensure all items are ready and update the system to move the order to the Dispatch Stage.

📦 *Order Details:*
• Order: ${order.orderNumber}
• Request Date: ${order.requestedAt ? new Date(order.requestedAt).toLocaleString('en-IN') : ''}
• Branch: ${order.branch?.name}

📊 *Current Status Flow:*
Arranging Completed → Packaging Completed → Ready for Dispatch

📋 *Action Required:*
✔ Confirm all items are packed
✔ Mark order as Packaging Completed / Ready for Dispatch in the system
✔ Upload Photos / Videos if required

Thank you! 🚀`;

    // Send notifications to packager
    const [emailResult, whatsAppResult] = await Promise.all([
      sendEmailNotification(packager.email, emailSubject, emailHtmlContent),
      sendWhatsAppNotification(packager.phoneNumber || process.env.SMARTWHAP_TEST_NUMBER, whatsAppMessage)
    ]);

    return {
      success: true,
      message: 'Packaging completed notification sent to packager',
      emailResult,
      whatsAppResult
    };

  } catch (error) {
    console.error('❌ Packaging completed notification to packager failed:', error);
    return {
      success: false,
      message: 'Failed to send packaging completed notification to packager',
      error: error.message
    };
  }
};

/**
 * Send packaging completed notification to manager
 * @param {Object} order - Order object with all details
 * @param {Object} manager - Manager user object
 */
const sendPackagingCompletedNotificationToManager = async (order, manager) => {
  try {
    console.log(`📬 Sending packaging completed notification to manager for order ${order.orderNumber}`);

    const companyName = 'Mystery Rooms';
    
    // Email subject
    const emailSubject = `Order Packaging Completed – Ready for Dispatch (Order ID: ${order.orderNumber})`;
    
    // Email HTML content
    const emailHtmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
        <div style="background-color: #059669; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">✅ Order Packaging Completed</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px;">Ready for Dispatch</p>
        </div>
        <div style="padding: 30px; background-color: white; margin: 20px;">
          <p style="color: #111827; font-size: 16px;">Dear ${manager.firstName} ${manager.lastName},</p>
          <p style="color: #374151; line-height: 1.6;">
            The Packaging Team has successfully completed the packaging for the below order.<br/>
            The order is now ready for dispatch.
          </p>

          <div style="background-color: #ecfdf5; border-left: 4px solid #059669; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #065f46; margin-top: 0;">Order Details</h3>
            <table style="width: 100%; color: #374151;">
              <tr style="border-bottom: 1px solid #a7f3d0;">
                <td style="padding: 12px 0; font-weight: bold; width: 45%;">Order ID:</td>
                <td style="padding: 12px 0; color: #059669; font-weight: bold; font-size: 16px;">${order.orderNumber}</td>
              </tr>
              <tr style="border-bottom: 1px solid #a7f3d0;">
                <td style="padding: 12px 0; font-weight: bold;">Request Date:</td>
                <td style="padding: 12px 0;">${order.requestedAt ? new Date(order.requestedAt).toLocaleString('en-IN') : ''}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; font-weight: bold;">Branch / Location:</td>
                <td style="padding: 12px 0;">${order.branch?.name || ''}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #075985; margin-top: 0;">Current Status Flow</h3>
            <p style="color: #075985; margin: 10px 0; line-height: 1.6; font-weight: bold;">
              Requested → Approved → Branch Confirmed → Arranging Completed → Packaging Completed / Ready for Dispatch
            </p>
          </div>

          <div style="background-color: #ecfdf5; border-left: 4px solid #059669; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <p style="color: #065f46; margin: 0; line-height: 1.6; font-weight: bold;">
              No immediate action is required from your side.
            </p>
            <p style="color: #065f46; margin: 10px 0 0 0; line-height: 1.6;">
              You will be notified once the order is dispatched.
            </p>
          </div>

          <p style="color: #6b7280; margin-top: 30px; line-height: 1.6;">
            Thank you,
          </p>

          <div style="background-color: #f3f4f6; padding: 15px; margin-top: 30px; border-radius: 4px; text-align: center;">
            <p style="color: #6b7280; margin: 0; font-size: 11px;">
              <strong>${companyName}</strong><br>
              Inventory & Procurement System<br>
              <strong>Order Reference:</strong> ${order.id}
            </p>
          </div>
        </div>
        <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">
            This is an automated notification from your inventory management system.
          </p>
        </div>
      </div>
    `;

    // WhatsApp message
    const whatsAppMessage = `✅ *Order Packaging Completed – Ready for Dispatch: ${order.orderNumber}*

Dear ${manager.firstName} ${manager.lastName},

The Packaging Team has successfully completed the packaging for the below order. The order is now ready for dispatch.

📦 *Order Details:*
• Order: ${order.orderNumber}
• Request Date: ${order.requestedAt ? new Date(order.requestedAt).toLocaleString('en-IN') : ''}
• Branch: ${order.branch?.name}

📊 *Current Status Flow:*
Requested → Approved → Branch Confirmed → Arranging Completed → Packaging Completed / Ready for Dispatch

No immediate action is required from your side. You will be notified once the order is dispatched.

Thank you! 🚀`;

    // Send notifications to manager
    const [emailResult, whatsAppResult] = await Promise.all([
      sendEmailNotification(manager.email, emailSubject, emailHtmlContent),
      sendWhatsAppNotification(manager.phoneNumber || process.env.SMARTWHAP_TEST_NUMBER, whatsAppMessage)
    ]);

    return {
      success: true,
      message: 'Packaging completed notification sent to manager',
      emailResult,
      whatsAppResult
    };

  } catch (error) {
    console.error('❌ Packaging completed notification to manager failed:', error);
    return {
      success: false,
      message: 'Failed to send packaging completed notification to manager',
      error: error.message
    };
  }
};

/**
 * Send dispatch task notification to dispatcher
 * @param {Object} order - Order object with all details
 * @param {Object} dispatcher - Dispatcher user object
 */
const sendDispatchTaskNotification = async (order, dispatcher) => {
  try {
    console.log(`📬 Sending dispatch task notification to dispatcher for order ${order.orderNumber}`);

    const companyName = 'Mystery Rooms';
    
    // Email subject
    const emailSubject = `New Dispatch Task – Please Dispatch Order (Order ID: ${order.orderNumber})`;
    
    // Email HTML content
    const emailHtmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
        <div style="background-color: #7c3aed; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">🚚 New Dispatch Task</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px;">Please Dispatch Order</p>
        </div>
        <div style="padding: 30px; background-color: white; margin: 20px;">
          <p style="color: #111827; font-size: 16px;">Dear ${dispatcher.firstName} ${dispatcher.lastName} / Dispatch Team,</p>
          <p style="color: #374151; line-height: 1.6;">
            The order has successfully completed the Packaging Stage and is now ready for dispatch.<br/>
            Please proceed with the dispatch process to the respective branch as per the schedule.
          </p>

          <div style="background-color: #f3f4ff; border-left: 4px solid #7c3aed; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #4c1d95; margin-top: 0;">Order Details</h3>
            <table style="width: 100%; color: #374151;">
              <tr style="border-bottom: 1px solid #ddd6fe;">
                <td style="padding: 12px 0; font-weight: bold; width: 45%;">Order ID:</td>
                <td style="padding: 12px 0; color: #7c3aed; font-weight: bold; font-size: 16px;">${order.orderNumber}</td>
              </tr>
              <tr style="border-bottom: 1px solid #ddd6fe;">
                <td style="padding: 12px 0; font-weight: bold;">Request Date:</td>
                <td style="padding: 12px 0;">${order.requestedAt ? new Date(order.requestedAt).toLocaleString('en-IN') : ''}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; font-weight: bold;">Branch / Location:</td>
                <td style="padding: 12px 0;">${order.branch?.name || ''}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #075985; margin-top: 0;">Current Status Flow</h3>
            <p style="color: #075985; margin: 10px 0; line-height: 1.6; font-weight: bold;">
              Requested → Manager Approved → Branch Confirmed → Arranging Completed → Packaging Completed → Ready for Dispatch
            </p>
          </div>

          <div style="background-color: #fef3c7; border-left: 4px solid #eab308; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #713f12; margin-top: 0;">Action Required</h3>
            <ul style="color: #713f12; margin: 10px 0; padding-left: 20px; line-height: 1.6;">
              <li>✔ Collect the packaged items</li>
              <li>✔ Verify the quantity and condition</li>
              <li>✔ Dispatch the order to the branch</li>
              <li>✔ Update the system once the order is dispatched</li>
              <li>✔ Upload any required Proof of Dispatch (Photos / Videos)</li>
            </ul>
          </div>

          <div style="background-color: #fef3c7; border-left: 4px solid #eab308; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <p style="color: #713f12; margin: 0; line-height: 1.6; font-weight: bold;">
              Please prioritize timely dispatch to ensure smooth delivery.
            </p>
          </div>

          <p style="color: #6b7280; margin-top: 30px; line-height: 1.6;">
            Thank you,
          </p>

          <div style="background-color: #f3f4f6; padding: 15px; margin-top: 30px; border-radius: 4px; text-align: center;">
            <p style="color: #6b7280; margin: 0; font-size: 11px;">
              <strong>${companyName}</strong><br>
              Inventory & Procurement System<br>
              <strong>Order Reference:</strong> ${order.id}
            </p>
          </div>
        </div>
        <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">
            This is an automated notification from your inventory management system.
          </p>
        </div>
      </div>
    `;

    // WhatsApp message
    const whatsAppMessage = `🚚 *New Dispatch Task – Please Dispatch Order: ${order.orderNumber}*

Dear ${dispatcher.firstName} ${dispatcher.lastName} / Dispatch Team,

The order has successfully completed the Packaging Stage and is now ready for dispatch. Please proceed with the dispatch process to the respective branch as per the schedule.

📦 *Order Details:*
• Order: ${order.orderNumber}
• Request Date: ${order.requestedAt ? new Date(order.requestedAt).toLocaleString('en-IN') : ''}
• Branch: ${order.branch?.name}

📊 *Current Status Flow:*
Requested → Manager Approved → Branch Confirmed → Arranging Completed → Packaging Completed → Ready for Dispatch

📋 *Action Required:*
✔ Collect the packaged items
✔ Verify the quantity and condition
✔ Dispatch the order to the branch
✔ Update the system once the order is dispatched
✔ Upload any required Proof of Dispatch (Photos / Videos)

Please prioritize timely dispatch to ensure smooth delivery.

Thank you! 🚀`;

    // Send notifications to dispatcher
    const [emailResult, whatsAppResult] = await Promise.all([
      sendEmailNotification(dispatcher.email, emailSubject, emailHtmlContent),
      sendWhatsAppNotification(dispatcher.phoneNumber || process.env.SMARTWHAP_TEST_NUMBER, whatsAppMessage)
    ]);

    return {
      success: true,
      message: 'Dispatch task notification sent',
      emailResult,
      whatsAppResult
    };

  } catch (error) {
    console.error('❌ Dispatch task notification failed:', error);
    return {
      success: false,
      message: 'Failed to send dispatch task notification',
      error: error.message
    };
  }
};

/**
 * Send in transit notification to manager
 * @param {Object} order - Order object with all details
 * @param {Object} manager - Manager user object
 */
const sendInTransitNotificationToManager = async (order, manager) => {
  try {
    console.log(`📬 Sending in transit notification to manager for order ${order.orderNumber}`);

    const companyName = 'Mystery Rooms';
    
    // Email subject
    const emailSubject = `Order In Transit Notification (Order ID: ${order.orderNumber})`;
    
    // Email HTML content
    const emailHtmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
        <div style="background-color: #dc2626; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">🚚 Order In Transit</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px;">Notification</p>
        </div>
        <div style="padding: 30px; background-color: white; margin: 20px;">
          <p style="color: #111827; font-size: 16px;">Dear ${manager.firstName} ${manager.lastName},</p>
          <p style="color: #374151; line-height: 1.6;">
            The dispatched order is now in transit to the branch.
          </p>

          <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #7f1d1d; margin-top: 0;">Order Details</h3>
            <table style="width: 100%; color: #374151;">
              <tr style="border-bottom: 1px solid #fecaca;">
                <td style="padding: 12px 0; font-weight: bold; width: 45%;">Order ID:</td>
                <td style="padding: 12px 0; color: #dc2626; font-weight: bold; font-size: 16px;">${order.orderNumber}</td>
              </tr>
              <tr style="border-bottom: 1px solid #fecaca;">
                <td style="padding: 12px 0; font-weight: bold;">Request Date:</td>
                <td style="padding: 12px 0;">${order.requestedAt ? new Date(order.requestedAt).toLocaleString('en-IN') : ''}</td>
              </tr>
              <tr style="border-bottom: 1px solid #fecaca;">
                <td style="padding: 12px 0; font-weight: bold;">Branch / Location:</td>
                <td style="padding: 12px 0;">${order.branch?.name || ''}</td>
              </tr>
              <tr style="border-bottom: 1px solid #fecaca;">
                <td style="padding: 12px 0; font-weight: bold;">Tracking ID:</td>
                <td style="padding: 12px 0;">${order.tracking?.trackingId || 'N/A'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #fecaca;">
                <td style="padding: 12px 0; font-weight: bold;">Tracking Link:</td>
                <td style="padding: 12px 0;">
                  ${order.tracking?.courierLink ? `<a href="${order.tracking.courierLink}" style="color: #dc2626; text-decoration: none;">Track Order</a>` : 'N/A'}
                </td>
              </tr>
              <tr>
                <td style="padding: 12px 0; font-weight: bold;">Expected Delivery:</td>
                <td style="padding: 12px 0;">${order.expectedDeliveryTime ? new Date(order.expectedDeliveryTime).toLocaleString('en-IN') : 'N/A'}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #075985; margin-top: 0;">Current Status Flow</h3>
            <p style="color: #075985; margin: 10px 0; line-height: 1.6; font-weight: bold;">
              Requested → Approved → Branch Confirmed → Arranging Completed → Packaging Completed → In Transit
            </p>
          </div>

          <div style="background-color: #ecfdf5; border-left: 4px solid #059669; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <p style="color: #065f46; margin: 0; line-height: 1.6; font-weight: bold;">
              No action is required from your side. You will be notified once the order is delivered.
            </p>
          </div>

          <p style="color: #6b7280; margin-top: 30px; line-height: 1.6;">
            Thank you,
          </p>

          <div style="background-color: #f3f4f6; padding: 15px; margin-top: 30px; border-radius: 4px; text-align: center;">
            <p style="color: #6b7280; margin: 0; font-size: 11px;">
              <strong>${companyName}</strong><br>
              Inventory & Procurement System<br>
              <strong>Order Reference:</strong> ${order.id}
            </p>
          </div>
        </div>
        <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">
            This is an automated notification from your inventory management system.
          </p>
        </div>
      </div>
    `;

    // WhatsApp message
    const whatsAppMessage = `🚚 *Order In Transit Notification: ${order.orderNumber}*

Dear ${manager.firstName} ${manager.lastName},

The dispatched order is now in transit to the branch.

📦 *Order Details:*
• Order: ${order.orderNumber}
• Request Date: ${order.requestedAt ? new Date(order.requestedAt).toLocaleString('en-IN') : ''}
• Branch: ${order.branch?.name}
• Tracking ID: ${order.tracking?.trackingId || 'N/A'}
• Expected Delivery: ${order.expectedDeliveryTime ? new Date(order.expectedDeliveryTime).toLocaleString('en-IN') : 'N/A'}

📊 *Current Status Flow:*
Requested → Approved → Branch Confirmed → Arranging Completed → Packaging Completed → In Transit

No action is required from your side. You will be notified once the order is delivered.

Thank you! 🚀`;

    // Send notifications to manager
    const [emailResult, whatsAppResult] = await Promise.all([
      sendEmailNotification(manager.email, emailSubject, emailHtmlContent),
      sendWhatsAppNotification(manager.phoneNumber || process.env.SMARTWHAP_TEST_NUMBER, whatsAppMessage)
    ]);

    return {
      success: true,
      message: 'In transit notification sent to manager',
      emailResult,
      whatsAppResult
    };

  } catch (error) {
    console.error('❌ In transit notification to manager failed:', error);
    return {
      success: false,
      message: 'Failed to send in transit notification to manager',
      error: error.message
    };
  }
};

/**
 * Send in transit notification to dispatcher
 * @param {Object} order - Order object with all details
 * @param {Object} dispatcher - Dispatcher user object
 */
const sendInTransitNotificationToDispatcher = async (order, dispatcher) => {
  try {
    console.log(`📬 Sending in transit notification to dispatcher for order ${order.orderNumber}`);

    const companyName = 'Mystery Rooms';
    
    // Email subject
    const emailSubject = `Order Dispatched – In Transit (Order ID: ${order.orderNumber})`;
    
    // Email HTML content
    const emailHtmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
        <div style="background-color: #dc2626; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">🚚 Order Dispatched</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px;">In Transit</p>
        </div>
        <div style="padding: 30px; background-color: white; margin: 20px;">
          <p style="color: #111827; font-size: 16px;">Dear ${dispatcher.firstName},</p>
          <p style="color: #374151; line-height: 1.6;">
            The order you dispatched is now in transit to the branch.
          </p>

          <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #7f1d1d; margin-top: 0;">Order Details</h3>
            <table style="width: 100%; color: #374151;">
              <tr style="border-bottom: 1px solid #fecaca;">
                <td style="padding: 12px 0; font-weight: bold; width: 45%;">Order ID:</td>
                <td style="padding: 12px 0; color: #dc2626; font-weight: bold; font-size: 16px;">${order.orderNumber}</td>
              </tr>
              <tr style="border-bottom: 1px solid #fecaca;">
                <td style="padding: 12px 0; font-weight: bold;">Request Date:</td>
                <td style="padding: 12px 0;">${order.requestedAt ? new Date(order.requestedAt).toLocaleString('en-IN') : ''}</td>
              </tr>
              <tr style="border-bottom: 1px solid #fecaca;">
                <td style="padding: 12px 0; font-weight: bold;">Branch / Location:</td>
                <td style="padding: 12px 0;">${order.branch?.name || ''}</td>
              </tr>
              <tr style="border-bottom: 1px solid #fecaca;">
                <td style="padding: 12px 0; font-weight: bold;">Tracking ID:</td>
                <td style="padding: 12px 0;">${order.tracking?.trackingId || 'N/A'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #fecaca;">
                <td style="padding: 12px 0; font-weight: bold;">Tracking Link:</td>
                <td style="padding: 12px 0;">
                  ${order.tracking?.courierLink ? `<a href="${order.tracking.courierLink}" style="color: #dc2626; text-decoration: none;">Track Order</a>` : 'N/A'}
                </td>
              </tr>
              <tr>
                <td style="padding: 12px 0; font-weight: bold;">Expected Delivery:</td>
                <td style="padding: 12px 0;">${order.expectedDeliveryTime ? new Date(order.expectedDeliveryTime).toLocaleString('en-IN') : 'N/A'}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #075985; margin-top: 0;">Current Status Flow</h3>
            <p style="color: #075985; margin: 10px 0; line-height: 1.6; font-weight: bold;">
              Requested → Manager Approved → Branch Confirmed → Arranging Completed → Packaging Completed → In Transit
            </p>
          </div>

          <div style="background-color: #ecfdf5; border-left: 4px solid #059669; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <p style="color: #065f46; margin: 0; line-height: 1.6; font-weight: bold;">
              Thank you for ensuring timely dispatch. Please follow up if there are any delays or issues during transit.
            </p>
          </div>

          <p style="color: #6b7280; margin-top: 30px; line-height: 1.6;">
            Thank you,
          </p>

          <div style="background-color: #f3f4f6; padding: 15px; margin-top: 30px; border-radius: 4px; text-align: center;">
            <p style="color: #6b7280; margin: 0; font-size: 11px;">
              <strong>${companyName}</strong><br>
              Inventory & Procurement System<br>
              <strong>Order Reference:</strong> ${order.id}
            </p>
          </div>
        </div>
        <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">
            This is an automated notification from your inventory management system.
          </p>
        </div>
      </div>
    `;

    // WhatsApp message
    const whatsAppMessage = `🚚 *Order Dispatched – In Transit: ${order.orderNumber}*

Dear ${dispatcher.firstName},

The order you dispatched is now in transit to the branch.

📦 *Order Details:*
• Order: ${order.orderNumber}
• Request Date: ${order.requestedAt ? new Date(order.requestedAt).toLocaleString('en-IN') : ''}
• Branch: ${order.branch?.name}
• Tracking ID: ${order.tracking?.trackingId || 'N/A'}
• Expected Delivery: ${order.expectedDeliveryTime ? new Date(order.expectedDeliveryTime).toLocaleString('en-IN') : 'N/A'}

📊 *Current Status Flow:*
Requested → Manager Approved → Branch Confirmed → Arranging Completed → Packaging Completed → In Transit

Thank you for ensuring timely dispatch. Please follow up if there are any delays or issues during transit.

Thank you! 🚀`;

    // Send notifications to dispatcher
    const [emailResult, whatsAppResult] = await Promise.all([
      sendEmailNotification(dispatcher.email, emailSubject, emailHtmlContent),
      sendWhatsAppNotification(dispatcher.phoneNumber || process.env.SMARTWHAP_TEST_NUMBER, whatsAppMessage)
    ]);

    return {
      success: true,
      message: 'In transit notification sent to dispatcher',
      emailResult,
      whatsAppResult
    };

  } catch (error) {
    console.error('❌ In transit notification to dispatcher failed:', error);
    return {
      success: false,
      message: 'Failed to send in transit notification to dispatcher',
      error: error.message
    };
  }
};

/**
 * Send received notification to manager
 * @param {Object} order - Order object with all details
 * @param {Object} manager - Manager user object
 */
const sendReceivedNotificationToManager = async (order, manager) => {
  try {
    console.log(`📬 Sending received notification to manager for order ${order.orderNumber}`);

    const companyName = 'Mystery Rooms';
    
    // Email subject
    const emailSubject = `Order Delivered to Branch – Confirmation (Order ID: ${order.orderNumber})`;
    
    // Email HTML content
    const emailHtmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
        <div style="background-color: #059669; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">✅ Order Delivered to Branch</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px;">Confirmation</p>
        </div>
        <div style="padding: 30px; background-color: white; margin: 20px;">
          <p style="color: #111827; font-size: 16px;">Dear ${manager.firstName} ${manager.lastName},</p>
          <p style="color: #374151; line-height: 1.6;">
            This is to inform you that the order has been <strong>successfully delivered and received</strong> by the branch.
          </p>

          <div style="background-color: #ecfdf5; border-left: 4px solid #059669; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #065f46; margin-top: 0;">Order Details</h3>
            <table style="width: 100%; color: #374151;">
              <tr style="border-bottom: 1px solid #d1fae5;">
                <td style="padding: 12px 0; font-weight: bold; width: 45%;">Order ID:</td>
                <td style="padding: 12px 0; color: #059669; font-weight: bold; font-size: 16px;">${order.orderNumber}</td>
              </tr>
              <tr style="border-bottom: 1px solid #d1fae5;">
                <td style="padding: 12px 0; font-weight: bold;">Request Date:</td>
                <td style="padding: 12px 0;">${order.requestedAt ? new Date(order.requestedAt).toLocaleString('en-IN') : ''}</td>
              </tr>
              <tr style="border-bottom: 1px solid #d1fae5;">
                <td style="padding: 12px 0; font-weight: bold;">Branch / Location:</td>
                <td style="padding: 12px 0;">${order.branch?.name || ''}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; font-weight: bold;">Delivery Date / Time:</td>
                <td style="padding: 12px 0;">${new Date().toLocaleString('en-IN')}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #075985; margin-top: 0;">Current Status Flow</h3>
            <p style="color: #075985; margin: 10px 0; line-height: 1.6; font-weight: bold;">
              Requested → Approved → Branch Confirmed → Arranging Completed → Packaging Completed → In Transit → Delivered / Received
            </p>
          </div>

          <div style="background-color: #ecfdf5; border-left: 4px solid #059669; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <p style="color: #065f46; margin: 0; line-height: 1.6; font-weight: bold;">
              No action is required at this stage. You will be notified if any discrepancies are reported by the branch.
            </p>
          </div>

          <p style="color: #6b7280; margin-top: 30px; line-height: 1.6;">
            Thank you,
          </p>

          <div style="background-color: #f3f4f6; padding: 15px; margin-top: 30px; border-radius: 4px; text-align: center;">
            <p style="color: #6b7280; margin: 0; font-size: 11px;">
              <strong>${companyName}</strong><br>
              Inventory & Procurement System<br>
              <strong>Order Reference:</strong> ${order.id}
            </p>
          </div>
        </div>
        <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">
            This is an automated notification from your inventory management system.
          </p>
        </div>
      </div>
    `;

    // WhatsApp message
    const whatsAppMessage = `✅ *Order Delivered to Branch – Confirmation: ${order.orderNumber}*

Dear ${manager.firstName} ${manager.lastName},

This is to inform you that the order has been successfully delivered and received by the branch.

📦 *Order Details:*
• Order: ${order.orderNumber}
• Request Date: ${order.requestedAt ? new Date(order.requestedAt).toLocaleString('en-IN') : ''}
• Branch: ${order.branch?.name}
• Delivery Date/Time: ${new Date().toLocaleString('en-IN')}

📊 *Current Status Flow:*
Requested → Approved → Branch Confirmed → Arranging Completed → Packaging Completed → In Transit → Delivered / Received

No action is required at this stage. You will be notified if any discrepancies are reported by the branch.

Thank you! 🚀`;

    // Send notifications to manager
    const [emailResult, whatsAppResult] = await Promise.all([
      sendEmailNotification(manager.email, emailSubject, emailHtmlContent),
      sendWhatsAppNotification(manager.phoneNumber || process.env.SMARTWHAP_TEST_NUMBER, whatsAppMessage)
    ]);

    return {
      success: true,
      message: 'Received notification sent to manager',
      emailResult,
      whatsAppResult
    };

  } catch (error) {
    console.error('❌ Received notification to manager failed:', error);
    return {
      success: false,
      message: 'Failed to send received notification to manager',
      error: error.message
    };
  }
};

/**
 * Send received notification to dispatcher
 * @param {Object} order - Order object with all details
 * @param {Object} dispatcher - Dispatcher user object
 */
const sendReceivedNotificationToDispatcher = async (order, dispatcher) => {
  try {
    console.log(`📬 Sending received notification to dispatcher for order ${order.orderNumber}`);

    const companyName = 'Mystery Rooms';
    
    // Email subject
    const emailSubject = `Order Successfully Delivered – Update (Order ID: ${order.orderNumber})`;
    
    // Email HTML content
    const emailHtmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
        <div style="background-color: #059669; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">✅ Order Successfully Delivered</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px;">Update</p>
        </div>
        <div style="padding: 30px; background-color: white; margin: 20px;">
          <p style="color: #111827; font-size: 16px;">Dear ${dispatcher.firstName},</p>
          <p style="color: #374151; line-height: 1.6;">
            The order you dispatched has been <strong>successfully delivered</strong> to the branch.
          </p>

          <div style="background-color: #ecfdf5; border-left: 4px solid #059669; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #065f46; margin-top: 0;">Order Details</h3>
            <table style="width: 100%; color: #374151;">
              <tr style="border-bottom: 1px solid #d1fae5;">
                <td style="padding: 12px 0; font-weight: bold; width: 45%;">Order ID:</td>
                <td style="padding: 12px 0; color: #059669; font-weight: bold; font-size: 16px;">${order.orderNumber}</td>
              </tr>
              <tr style="border-bottom: 1px solid #d1fae5;">
                <td style="padding: 12px 0; font-weight: bold;">Request Date:</td>
                <td style="padding: 12px 0;">${order.requestedAt ? new Date(order.requestedAt).toLocaleString('en-IN') : ''}</td>
              </tr>
              <tr style="border-bottom: 1px solid #d1fae5;">
                <td style="padding: 12px 0; font-weight: bold;">Branch / Location:</td>
                <td style="padding: 12px 0;">${order.branch?.name || ''}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; font-weight: bold;">Delivery Date / Time:</td>
                <td style="padding: 12px 0;">${new Date().toLocaleString('en-IN')}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #075985; margin-top: 0;">Current Status Flow</h3>
            <p style="color: #075985; margin: 10px 0; line-height: 1.6; font-weight: bold;">
              Requested → Manager Approved → Branch Confirmed → Arranging Completed → Packaging Completed → In Transit → Delivered / Received
            </p>
          </div>

          <div style="background-color: #ecfdf5; border-left: 4px solid #059669; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <p style="color: #065f46; margin: 0; line-height: 1.6; font-weight: bold;">
              Thank you for ensuring timely and safe delivery. Please mark the order as Delivered / Completed in the system.
            </p>
          </div>

          <p style="color: #6b7280; margin-top: 30px; line-height: 1.6;">
            Thank you,
          </p>

          <div style="background-color: #f3f4f6; padding: 15px; margin-top: 30px; border-radius: 4px; text-align: center;">
            <p style="color: #6b7280; margin: 0; font-size: 11px;">
              <strong>${companyName}</strong><br>
              Inventory & Procurement System<br>
              <strong>Order Reference:</strong> ${order.id}
            </p>
          </div>
        </div>
        <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">
            This is an automated notification from your inventory management system.
          </p>
        </div>
      </div>
    `;

    // WhatsApp message
    const whatsAppMessage = `✅ *Order Successfully Delivered – Update: ${order.orderNumber}*

Dear ${dispatcher.firstName},

The order you dispatched has been successfully delivered to the branch.

📦 *Order Details:*
• Order: ${order.orderNumber}
• Request Date: ${order.requestedAt ? new Date(order.requestedAt).toLocaleString('en-IN') : ''}
• Branch: ${order.branch?.name}
• Delivery Date/Time: ${new Date().toLocaleString('en-IN')}

📊 *Current Status Flow:*
Requested → Manager Approved → Branch Confirmed → Arranging Completed → Packaging Completed → In Transit → Delivered / Received

Thank you for ensuring timely and safe delivery. Please mark the order as Delivered / Completed in the system.

Thank you! 🚀`;

    // Send notifications to dispatcher
    const [emailResult, whatsAppResult] = await Promise.all([
      sendEmailNotification(dispatcher.email, emailSubject, emailHtmlContent),
      sendWhatsAppNotification(dispatcher.phoneNumber || process.env.SMARTWHAP_TEST_NUMBER, whatsAppMessage)
    ]);

    return {
      success: true,
      message: 'Received notification sent to dispatcher',
      emailResult,
      whatsAppResult
    };

  } catch (error) {
    console.error('❌ Received notification to dispatcher failed:', error);
    return {
      success: false,
      message: 'Failed to send received notification to dispatcher',
      error: error.message
    };
  }
};

module.exports = {
  sendEmailNotification,
  sendWhatsAppNotification,
  sendOrderCreatedNotification,
  sendOrderApprovedConfirmedNotification,
  sendOrderUpdatedByManagerNotification,
  sendOrderConfirmPendingNotification,
  sendOrderDispatchNotification,
  sendOrderStatusUpdateNotification,
  sendOrderReceivedNotification,
  sendOrderClosedNotification,
  sendManagerReplyNotification,
  sendManagerReplyConfirmationNotification,
  sendOrderUpdatedToRequesterNotification,
  sendBranchConfirmationToManagerNotification,
  sendBranchConfirmationReceivedNotification,
  sendBranchIssueSubmittedNotification,
  sendOrderApprovedConfirmedNotification,
  sendBranchIssuePendingManagerActionNotification,
  notifyItemBackInStock,
  notifyUsers,
  sendPackagingAssignmentNotification,
  sendPackagingStageStartedNotification,
  sendPackagingInProgressNotificationToPackager,
  sendPackagingInProgressNotificationToManager,
  sendPackagingCompletedNotificationToPackager,
  sendPackagingCompletedNotificationToManager,
  sendDispatchTaskNotification,
  sendInTransitNotificationToManager,
  sendInTransitNotificationToDispatcher,
  sendReceivedNotificationToManager,
  sendReceivedNotificationToDispatcher
};
