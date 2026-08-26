const { Resend } = require('resend');
const collections = require('./collections');
const { formatPhoneForGhana } = require('./phone');
const config = require('./config');

async function sendAdminOrderNotifications(order) {
  const itemsText = (order.items || []).map(it => `${it.qty}x ${it.name} (GH₵ ${it.price})`).join(', ');

  // 1. In-Dashboard Notification Record (now actually persisted, not just local JSON)
  const adminNotif = {
    id: `notif-${Date.now()}`,
    type: 'order',
    title: `⚡ New Order #${order.id} Placed!`,
    message: `${order.name} ordered ${order.items?.length || 1} items totaling GH₵ ${Number(order.total || 0).toFixed(2)} (${order.city}, ${order.payment}).`,
    date: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' • ' + new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
    target: 'admin',
    orderId: order.id,
    read: false
  };
  try {
    await collections.notifications.insert(adminNotif);
  } catch (e) {
    console.warn('Admin notification record could not be saved:', e.message);
  }

  // 2. Dispatch SMS to Admin & Customer via mNotify / BMS Quick Bulk SMS API
  const mnotifyKey = config.MNOTIFY_API_KEY;
  const adminPhone = config.ADMIN_PHONE;
  const mnotifySender = config.MNOTIFY_SENDER;

  const adminPhoneFormatted = formatPhoneForGhana(adminPhone);
  const customerPhoneFormatted = formatPhoneForGhana(order.phone);

  try {
    if (mnotifyKey) {
      const fetchFn = typeof fetch !== 'undefined' ? fetch : global.fetch;

      // Admin SMS Alert
      const adminSmsBody = `ByMarie Alert: New Order #${order.id} received from ${order.name} (${order.phone}) for GH₵ ${Number(order.total || 0).toFixed(2)}. Destination: ${order.city}. Status: Processing.`;
      await fetchFn(`https://api.mnotify.com/api/sms/quick?key=${mnotifyKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: [adminPhoneFormatted],
          sender: mnotifySender,
          message: adminSmsBody,
          is_schedule: false,
          schedule_date: ''
        })
      });

      // Customer Confirmation SMS Receipt
      if (customerPhoneFormatted && customerPhoneFormatted.length >= 10) {
        const customerSmsBody = `ByMarie: Thank you for your order, ${order.name}! Order #${order.id} for GH₵ ${Number(order.total || 0).toFixed(2)} has been verified and is being prepared for express delivery to ${order.city}. Track status: bymarie.shop/#account`;
        await fetchFn(`https://api.mnotify.com/api/sms/quick?key=${mnotifyKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: [customerPhoneFormatted],
            sender: mnotifySender,
            message: customerSmsBody,
            is_schedule: false,
            schedule_date: ''
          })
        });
      }

      console.log(`📱 [mNotify BMS SMS DISPATCH] Admin & Customer SMS receipts sent successfully`);
    }
  } catch (err) {
    console.warn('SMS dispatch notification note:', err.message);
  }

  // 3. Dispatch Email to Admin and Customer via Resend
  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e4e4e7; border-radius: 8px; overflow: hidden;">
      <div style="background: #182822; color: #fff; padding: 24px; text-align: center;">
        <h1 style="letter-spacing: 3px; margin: 0; font-size: 24px;">BYMARIE</h1>
        <p style="color: #e8cca4; margin: 6px 0 0; font-size: 13px;">HAUTE COUTURE ATELIER • ACCRA</p>
      </div>
      <div style="padding: 24px; background: #fff;">
        <h2 style="color: #182822; margin-top: 0;">⚡ Order Confirmation: #${order.id}</h2>
        <p style="color: #52525b; font-size: 14px;">Thank you for shopping at ByMarie. Your luxury order has been verified and queued for express dispatch.</p>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
          <tr style="background: #faf5f6;"><td style="padding: 8px 12px; font-weight: bold;">Client Name:</td><td style="padding: 8px 12px;">${order.name}</td></tr>
          <tr><td style="padding: 8px 12px; font-weight: bold;">Phone Number:</td><td style="padding: 8px 12px;">${order.phone}</td></tr>
          <tr style="background: #faf5f6;"><td style="padding: 8px 12px; font-weight: bold;">Email:</td><td style="padding: 8px 12px;">${order.email || 'N/A'}</td></tr>
          <tr><td style="padding: 8px 12px; font-weight: bold;">Delivery Address:</td><td style="padding: 8px 12px;">${order.address}, ${order.city} (${order.region})</td></tr>
          <tr style="background: #faf5f6;"><td style="padding: 8px 12px; font-weight: bold;">Payment Method:</td><td style="padding: 8px 12px;">${order.payment}</td></tr>
          <tr><td style="padding: 8px 12px; font-weight: bold;">Grand Total:</td><td style="padding: 8px 12px; font-weight: bold; color: #047857; font-size: 16px;">GH₵ ${Number(order.total || 0).toFixed(2)}</td></tr>
        </table>

        <h3 style="font-size: 15px; margin-bottom: 8px;">Itemized Pieces:</h3>
        <p style="background: #f4f4f5; padding: 12px; border-radius: 6px; font-size: 13px; color: #27272a;">${itemsText}</p>

        <div style="text-align: center; margin-top: 24px;">
          <a href="https://bymarie.vercel.app/#account" style="background: #c24d67; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; display: inline-block;">Track Order in Member Hub →</a>
        </div>
      </div>
      <div style="background: #fafafa; padding: 16px; text-align: center; font-size: 12px; color: #71717a; border-top: 1px solid #e4e4e7;">
        ByMarie Luxury E-Commerce Notification Engine • Cantonments, Accra
      </div>
    </div>
  `;

  try {
    const resendApiKey = config.RESEND_API_KEY;
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);
      const fromAddress = config.RESEND_FROM_EMAIL;
      const targetAdmin = config.ADMIN_EMAIL;

      const emailRecipients = [targetAdmin];
      if (order.email && order.email.includes('@') && !emailRecipients.includes(order.email)) {
        emailRecipients.push(order.email);
      }

      await resend.emails.send({
        from: fromAddress,
        to: emailRecipients,
        reply_to: targetAdmin,
        subject: `⚡ Order Confirmation #${order.id} (GH₵ ${Number(order.total || 0).toFixed(2)}) - ByMarie`,
        text: `Order Confirmation #${order.id}\nTotal: GH₵ ${Number(order.total || 0).toFixed(2)}\nClient: ${order.name}\n\nTrack order at https://bymarie.shop/#account`,
        html: emailHtml
      });
      console.log(`📧 [EMAIL DISPATCH via Resend SDK] Alert sent to recipients:`, emailRecipients);
    }
  } catch (err) {
    console.warn('Email dispatch notification note:', err.message);
  }
}

module.exports = { sendAdminOrderNotifications };
