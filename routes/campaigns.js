const express = require('express');
const { Resend } = require('resend');
const collections = require('../lib/collections');
const asyncHandler = require('../lib/asyncHandler');
const { formatPhoneForGhana } = require('../lib/phone');
const config = require('../lib/config');

const router = express.Router();

// 1. Bulk SMS Broadcast via mNotify / BMS
router.post('/sms/broadcast', asyncHandler(async (req, res) => {
  try {
    const { recipients, message, sender } = req.body;
    if (!recipients || !Array.isArray(recipients) || !recipients.length) {
      return res.status(400).json({ error: 'No recipients provided' });
    }
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'SMS message content is required' });
    }

    const mnotifyKey = config.MNOTIFY_API_KEY;
    const formattedRecipients = recipients.map(formatPhoneForGhana).filter(p => p && p.length >= 10);
    const mnotifySender = (sender || config.MNOTIFY_SENDER).substring(0, 11);

    let apiResult = null;
    let isLive = false;

    if (mnotifyKey && formattedRecipients.length > 0) {
      const fetchFn = typeof fetch !== 'undefined' ? fetch : global.fetch;
      try {
        const response = await fetchFn(`https://api.mnotify.com/api/sms/quick?key=${mnotifyKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: formattedRecipients,
            sender: mnotifySender,
            message: message.trim(),
            is_schedule: false,
            schedule_date: ''
          })
        });
        apiResult = await response.json();
        isLive = true;
        console.log(`📱 [mNotify SMS Broadcast Sent] To ${formattedRecipients.length} clients:`, apiResult);
      } catch (err) {
        console.warn('mNotify dispatch call error:', err.message);
      }
    }

    const campaignLog = {
      id: `cmp-sms-${Date.now()}`,
      channel: 'SMS',
      title: message.trim().substring(0, 45) + (message.length > 45 ? '...' : ''),
      content: message.trim(),
      sender: mnotifySender,
      recipientsCount: formattedRecipients.length,
      recipients: formattedRecipients.slice(0, 10),
      status: isLive ? 'Delivered' : 'Simulated (Dev Mode)',
      timestamp: new Date().toISOString(),
      dateFormatted: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      meta: apiResult
    };

    const savedCampaign = await collections.campaigns.insert(campaignLog);

    res.json({
      success: true,
      count: formattedRecipients.length,
      sender: mnotifySender,
      live: isLive,
      campaign: savedCampaign,
      apiResult
    });
  } catch (err) {
    console.error('SMS Broadcast error:', err);
    res.status(500).json({ error: err.message });
  }
}));

// 2. Bulk Luxury Email Broadcast via Resend
router.post('/email/broadcast', asyncHandler(async (req, res) => {
  try {
    const { recipients, subject, headline, content, ctaText, ctaUrl, previewText } = req.body;
    if (!recipients || !Array.isArray(recipients) || !recipients.length) {
      return res.status(400).json({ error: 'No email recipients provided' });
    }
    if (!subject || !subject.trim()) {
      return res.status(400).json({ error: 'Email subject line is required' });
    }
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Email content is required' });
    }

    const cleanContent = String(content || '').trim();
    const resendApiKey = config.RESEND_API_KEY;
    const fromAddress = process.env.RESEND_FROM_EMAIL || 'ByMarie Concierge <concierge@bymarie.shop>';
    const validRecipients = recipients
      .map(r => String(r || '').trim().toLowerCase())
      .filter(r => r && r.includes('@') && r.includes('.'));

    if (!validRecipients.length) {
      return res.status(400).json({ error: 'No valid recipient email addresses found' });
    }

    // Build Luxury ByMarie HTML Email Template
    const paragraphsHtml = content.split('\n\n').map(p => `<p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.7; color: #3f3f46;">${p.replace(/\n/g, '<br/>')}</p>`).join('');
    const ctaButtonHtml = (ctaText && ctaUrl) ? `
      <div style="margin: 32px 0 24px 0; text-align: center;">
        <a href="${ctaUrl}" target="_blank" style="background: #083832; color: #fdfbf7; padding: 14px 32px; font-family: 'Playfair Display', Georgia, serif; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 4px; display: inline-block; letter-spacing: 0.5px; border: 1px solid #d4af37;">
          ${ctaText} →
        </a>
      </div>
    ` : '';

    const emailHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="margin:0; padding:0; background-color:#f4f4f5; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <div style="max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06); border: 1px solid #e4e4e7;">

          <!-- Header Banner -->
          <div style="background: linear-gradient(135deg, #083832 0%, #0d4a43 100%); padding: 36px 30px; text-align: center; border-bottom: 2px solid #d4af37;">
            <div style="font-family: 'Cinzel', 'Playfair Display', Georgia, serif; font-size: 26px; font-weight: 700; color: #ffffff; letter-spacing: 3px; margin: 0;">BYMARIE</div>
            <div style="color: #d4af37; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin-top: 6px;">Luxury Style • Scent Extraits • Essentials • Ghana</div>
          </div>

          <!-- Main Content -->
          <div style="padding: 36px 32px;">
            ${headline ? `<h1 style="font-family: 'Playfair Display', Georgia, serif; font-size: 22px; font-weight: 600; color: #083832; margin: 0 0 20px 0; line-height: 1.4;">${headline}</h1>` : ''}

            ${paragraphsHtml}

            ${ctaButtonHtml}

            <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #f4f4f5; font-size: 13px; color: #71717a;">
              <strong style="color: #083832; display: block; margin-bottom: 4px;">ByMarie Private Client Atelier</strong>
              Executive Concierge: Cantonments &amp; East Legon, Accra, Ghana<br/>
              WhatsApp Concierge: +233 24 100 2000
            </div>
          </div>

          <!-- Footer -->
          <div style="background-color: #083832; padding: 20px 30px; text-align: center; font-size: 11.5px; color: #a1a1aa; border-top: 1px solid #1a4a44;">
            <p style="margin: 0 0 8px 0; color: #d4af37;">Exclusive VIP Dispatch from ByMarie Luxury Atelier</p>
            <p style="margin: 0; color: #71717a;">© ${new Date().getFullYear()} ByMarie Ghana. All rights reserved.</p>
          </div>

        </div>
      </body>
      </html>
    `;

    const users = await collections.users.list();

    let isLive = false;
    let deliveredCount = 0;
    let failedCount = 0;
    const deliveryLogs = [];

    if (resendApiKey) {
      const resend = new Resend(resendApiKey);

      // Build personalized batch email payload
      const batchPayload = validRecipients.map(recipient => {
        const recipientUser = users.find(u => u.email && u.email.toLowerCase() === recipient.toLowerCase());
        const recipientName = recipientUser ? recipientUser.name : recipient.split('@')[0];
        const personalizedHtml = emailHtml.replace(/\{name\}/g, recipientName);
        const personalizedText = `${headline ? headline + '\n\n' : ''}${cleanContent.replace(/\{name\}/g, recipientName)}\n\nByMarie Luxury Atelier\nCantonments & East Legon, Accra\nhttps://bymarie.shop`;

        return {
          from: fromAddress,
          to: [recipient],
          reply_to: config.ADMIN_EMAIL,
          subject: subject.trim(),
          text: personalizedText,
          html: personalizedHtml,
          headers: {
            'X-Entity-Ref-ID': `camp-${Date.now()}`
          }
        };
      });

      // Send via Resend Batch SDK
      try {
        if (batchPayload.length === 1) {
          const singleRes = await resend.emails.send(batchPayload[0]);
          if (singleRes.data && singleRes.data.id) {
            deliveredCount = 1;
            isLive = true;
            deliveryLogs.push({ email: validRecipients[0], status: 'Sent', id: singleRes.data.id });
          } else {
            failedCount = 1;
            deliveryLogs.push({ email: validRecipients[0], status: 'Declined', error: singleRes.error ? singleRes.error.message : 'Unknown error' });
          }
        } else {
          // Process in batches of up to 100 as per Resend API limits
          const chunkSize = 100;
          for (let i = 0; i < batchPayload.length; i += chunkSize) {
            const chunk = batchPayload.slice(i, i + chunkSize);
            const batchResult = await resend.batch.send(chunk);

            if (batchResult.data && Array.isArray(batchResult.data.data)) {
              batchResult.data.data.forEach((item, idx) => {
                const recEmail = chunk[idx].to[0];
                if (item.id) {
                  deliveredCount++;
                  isLive = true;
                  deliveryLogs.push({ email: recEmail, status: 'Sent', id: item.id });
                } else {
                  failedCount++;
                  deliveryLogs.push({ email: recEmail, status: 'Declined' });
                }
              });
            } else if (batchResult.data && Array.isArray(batchResult.data)) {
              batchResult.data.forEach((item, idx) => {
                const recEmail = chunk[idx].to[0];
                if (item.id) {
                  deliveredCount++;
                  isLive = true;
                  deliveryLogs.push({ email: recEmail, status: 'Sent', id: item.id });
                } else {
                  failedCount++;
                  deliveryLogs.push({ email: recEmail, status: 'Declined' });
                }
              });
            } else if (batchResult.error) {
              failedCount += chunk.length;
              chunk.forEach(c => deliveryLogs.push({ email: c.to[0], status: 'Error', error: batchResult.error.message }));
            }
          }
        }
      } catch (sdkErr) {
        console.error('Resend SDK Batch Send Error:', sdkErr);
        failedCount = validRecipients.length;
        validRecipients.forEach(r => deliveryLogs.push({ email: r, status: 'Error', error: sdkErr.message }));
      }
    } else {
      deliveredCount = validRecipients.length;
      deliveryLogs.push({ status: 'Simulated', count: validRecipients.length });
    }

    const campaignLog = {
      id: `cmp-mail-${Date.now()}`,
      channel: 'EMAIL',
      title: subject.trim(),
      headline: headline || '',
      content: content.trim(),
      recipientsCount: validRecipients.length,
      deliveredCount,
      failedCount,
      recipients: validRecipients.slice(0, 10),
      status: (resendApiKey && deliveredCount > 0) ? `Dispatched (${deliveredCount}/${validRecipients.length})` : (resendApiKey ? 'Failed / Domain Sandbox' : 'Simulated (Dev Mode)'),
      timestamp: new Date().toISOString(),
      dateFormatted: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      deliveryLogs
    };

    const savedCampaign = await collections.campaigns.insert(campaignLog);

    res.json({
      success: true,
      count: validRecipients.length,
      delivered: deliveredCount,
      failed: failedCount,
      live: isLive,
      campaign: savedCampaign,
      logs: deliveryLogs
    });
  } catch (err) {
    console.error('Email Broadcast error:', err);
    res.status(500).json({ error: err.message });
  }
}));

// 3. Get Campaign Broadcast History
router.get('/campaigns', asyncHandler(async (req, res) => {
  const campaigns = await collections.campaigns.list();
  res.json(campaigns);
}));

module.exports = router;
