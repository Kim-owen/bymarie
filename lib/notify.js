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

async function notifyAllUsersNewProduct(product) {
  if (!product || !product.name) return;

  try {
    const users = await collections.users.list();
    if (!Array.isArray(users) || !users.length) {
      console.log('No registered users found for automated new product notification.');
      return;
    }

    const emailRecipients = users.map(u => u.email).filter(e => e && e.includes('@'));
    const phoneRecipients = users.map(u => formatPhoneForGhana(u.phone)).filter(p => p && p.length >= 10);

    const prodName = product.name;
    const prodCategory = product.category || 'Luxury Collection';
    const prodPrice = Number(product.price || 0).toFixed(2);
    const prodImage = product.image || 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800';

    console.log(`✨ [AUTOMATED PRODUCT BROADCAST] Initiated for "${prodName}": ${emailRecipients.length} Email(s), ${phoneRecipients.length} SMS Recipient(s).`);

    // 1. Dispatch SMS Broadcast via mNotify / BMS Quick SMS API
    const mnotifyKey = config.MNOTIFY_API_KEY;
    const mnotifySender = (config.MNOTIFY_SENDER || 'BYMARIE').substring(0, 11);

    if (mnotifyKey && phoneRecipients.length > 0) {
      const smsBody = `ByMarie New Arrival! ✨ ${prodName} (${prodCategory}) is now live for GH₵ ${prodPrice}. View & Order now: https://bymarie.shop/#product/${product.id}`;
      try {
        const fetchFn = typeof fetch !== 'undefined' ? fetch : global.fetch;
        await fetchFn(`https://api.mnotify.com/api/sms/quick?key=${mnotifyKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: phoneRecipients,
            sender: mnotifySender,
            message: smsBody,
            is_schedule: false,
            schedule_date: ''
          })
        });
        console.log(`📱 [Automated SMS Broadcast] Sent to ${phoneRecipients.length} clients for product: ${prodName}`);
      } catch (smsErr) {
        console.warn('Automated SMS Broadcast call error:', smsErr.message);
      }
    }

    // 2. Dispatch Email Broadcast via Resend
    const resendApiKey = config.RESEND_API_KEY;
    const fromAddress = config.RESEND_FROM_EMAIL || 'ByMarie Concierge <concierge@bymarie.shop>';

    if (resendApiKey && emailRecipients.length > 0) {
      const resend = new Resend(resendApiKey);

      const htmlBody = `
        <div style="font-family:'Montserrat',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#09090b;color:#fff;padding:40px 24px;border-radius:12px">
          <div style="text-align:center;margin-bottom:30px">
            <span style="font-size:11px;letter-spacing:4px;color:#c24d67;text-transform:uppercase;font-weight:700;display:block">NEW ARRIVAL ALERT</span>
            <h1 style="font-size:28px;font-weight:900;letter-spacing:2px;margin:10px 0 0;color:#fff">BYMARIE LUXURY</h1>
          </div>

          <div style="background:#18181b;border:1px solid #27272a;border-radius:10px;overflow:hidden;margin-bottom:24px">
            <img src="${prodImage}" alt="${prodName}" style="width:100%;max-height:360px;object-fit:cover;display:block">
            <div style="padding:24px">
              <span style="background:rgba(194,77,103,0.2);color:#ffb3c1;border:1px solid rgba(194,77,103,0.3);font-size:10px;font-weight:800;padding:4px 10px;border-radius:20px;display:inline-block;margin-bottom:12px">${prodCategory.toUpperCase()}</span>
              <h2 style="font-size:22px;margin:0 0 8px;color:#fff">${prodName}</h2>
              <p style="color:#a1a1aa;font-size:14px;line-height:1.5;margin:0 0 16px">${product.desc || 'Explore our newest luxury arrival crafted with ultimate precision and luxury standards.'}</p>
              <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid #27272a;padding-top:16px">
                <span style="font-size:22px;font-weight:800;color:#facc15">GH₵ ${prodPrice}</span>
                <a href="https://bymarie.shop/#product/${product.id}" style="background:#c24d67;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-weight:700;font-size:13px;display:inline-block">Shop Piece Now →</a>
              </div>
            </div>
          </div>

          <div style="text-align:center;color:#71717a;font-size:11px;border-top:1px solid #27272a;padding-top:20px">
            <p style="margin:0 0 6px">ByMarie Luxury Atelier • Accra, Ghana</p>
            <p style="margin:0">You received this exclusive update as a registered VIP member.</p>
          </div>
        </div>
      `;

      for (const emailTarget of emailRecipients) {
        try {
          await resend.emails.send({
            from: fromAddress,
            to: emailTarget,
            subject: `✨ New Arrival: ${prodName} is now live on ByMarie!`,
            html: htmlBody
          });
        } catch (e) {
          console.warn(`Automated email dispatch note to ${emailTarget}:`, e.message);
        }
      }
      console.log(`📧 [Automated Email Broadcast] Sent to ${emailRecipients.length} VIP members for product: ${prodName}`);
    }

    // 3. Log Campaign Broadcast Entry
    try {
      await collections.campaigns.insert({
        id: `camp-auto-${Date.now()}`,
        name: `Automated New Product Alert: ${prodName}`,
        channel: 'EMAIL & SMS',
        segment: 'All Registered Members',
        recipientsCount: emailRecipients.length + phoneRecipients.length,
        status: 'Dispatched',
        date: new Date().toISOString()
      });
    } catch (e) {}

  } catch (err) {
    console.error('Error in notifyAllUsersNewProduct:', err.message);
  }
}

module.exports = { sendAdminOrderNotifications, notifyAllUsersNewProduct };
