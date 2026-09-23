import 'dotenv/config';
import { Resend } from 'resend';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { validateDateRange } from '../assets/js/modules/validators.js';
import { insertEnquiry } from './bigquery.js';
import { randomUUID } from 'crypto';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });
  }

  const data = req.body || {};
  const requiredFields = ["name", "phone", "details"];
  const missingFields = requiredFields.filter((field) => !String(data[field] || "").trim());

  if (missingFields.length) {
    return res.status(400).json({
      success: false,
      message: "Please complete the required fields before sending your enquiry."
    });
  }

  // The frontend always sends the phone number in E.164 form (+<country
  // code><number>) after resolving it against the country the guest picked,
  // so no country hint is needed here — libphonenumber-js can validate a
  // full E.164 string on its own.
  const parsedPhone = parsePhoneNumberFromString(String(data.phone || ''));
  if (!parsedPhone || !parsedPhone.isValid()) {
    return res.status(400).json({
      success: false,
      message: "Please provide a valid phone number, including country code."
    });
  }
  data.phone = parsedPhone.number;

  const dateRangeResult = validateDateRange(data.check_in, data.check_out);
  if (!dateRangeResult.valid) {
    return res.status(400).json({
      success: false,
      message: dateRangeResult.message
    });
  }

  try {
    // Parse details to extract check_in, check_out, guests info
    // Details format: "Arriving 15th July, staying 7 days. Family of 4 (2 adults, 2 kids). Need 2 rooms with kitchen..."
    const detailsText = data.details || '';
    const adults = parseInt(data.adults) || 1;
    const children = parseInt(data.children) || 0;
    const petCount = parseInt(data.pet_count) || 0;
    const petType = data.pets || 'none';
    
    // Prepare enquiry data mapping form fields to table columns
    const enquiryId = randomUUID();
    const enquiryData = {
      id: enquiryId,
      created_at: new Date().toISOString(),
      name: data.name,
      email: data.email || null,
      email_verified: Boolean(data.email_verified),
      phone: data.phone,
      check_in: data.check_in || null,
      check_out: data.check_out || null,
      adults: adults,
      children: children,
      guests: `${adults} adult(s), ${children} child(ren)${petCount > 0 ? ', ' + petCount + ' pet(s)' : ''}`,
      property_slug: data.preferred_stay || null,
      area: data.area || null,
      coming_from_city: data.coming_from_city || null,
      pets: petType,
      pet_count: petCount,
      message: detailsText,
      source: data.source || 'website_form',
      status: 'pending',
      ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress || null,
      user_agent: req.headers['user-agent'] || null,
      referrer: req.headers['referer'] || null
    };

    // Store in BigQuery
    await insertEnquiry(enquiryData);

    console.log("✅ Data stored in BigQuery:", enquiryId);

    // Send email via Resend with tabular format
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">New Rishikesh Homestay Enquiry</h2>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background-color: #f5f5f5;">
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold; width: 30%;">Name</td>
            <td style="padding: 12px; border: 1px solid #ddd;">${data.name}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">Phone</td>
            <td style="padding: 12px; border: 1px solid #ddd;">${data.phone}</td>
          </tr>
          <tr style="background-color: #f5f5f5;">
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">Email</td>
            <td style="padding: 12px; border: 1px solid #ddd;">${data.email || 'Not provided'}${data.email ? (enquiryData.email_verified ? ' ✅ Verified' : ' (not verified)') : ''}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">Check-in</td>
            <td style="padding: 12px; border: 1px solid #ddd;">${data.check_in || 'Not specified'}</td>
          </tr>
          <tr style="background-color: #f5f5f5;">
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">Check-out</td>
            <td style="padding: 12px; border: 1px solid #ddd;">${data.check_out || 'Not specified'}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">Preferred Property</td>
            <td style="padding: 12px; border: 1px solid #ddd;">${data.preferred_stay || 'Open to suggestions'}</td>
          </tr>
          <tr style="background-color: #f5f5f5;">
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">Preferred Area</td>
            <td style="padding: 12px; border: 1px solid #ddd;">${data.area || 'Not specified'}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">Coming from (City)</td>
            <td style="padding: 12px; border: 1px solid #ddd;">${data.coming_from_city || 'Not specified'}</td>
          </tr>
          <tr style="background-color: #f5f5f5;">
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">Adults</td>
            <td style="padding: 12px; border: 1px solid #ddd;">${adults}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">Children</td>
            <td style="padding: 12px; border: 1px solid #ddd;">${children}</td>
          </tr>
          <tr style="background-color: #f5f5f5;">
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">Pets Type</td>
            <td style="padding: 12px; border: 1px solid #ddd;">${petType}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">Pet Count</td>
            <td style="padding: 12px; border: 1px solid #ddd;">${petCount}</td>
          </tr>
          <tr style="background-color: #f5f5f5;">
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">Trip Details</td>
            <td style="padding: 12px; border: 1px solid #ddd; white-space: pre-wrap;">${data.details}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">Submitted At</td>
            <td style="padding: 12px; border: 1px solid #ddd;">${new Date().toLocaleString()}</td>
          </tr>
        </table>
        <p style="color: #666; margin-top: 20px; font-size: 12px;">This enquiry has been logged in your database.</p>
      </div>
    `;

    const emailResponse = await resend.emails.send({
      from: 'noreply@rishikeshhomestays.com',
      to: 'hello@rishikeshhomestays.com',
      subject: `New Enquiry from ${data.name} - Rishikesh Homestay`,
      html: emailHtml
    });

    console.log("✅ Email sent via Resend:", emailResponse);

    // Send confirmation email to guest if email provided
    if (data.email) {
      const confirmationHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Thank You! Your Enquiry is Received</h2>
          <p>Hi ${data.name},</p>
          <p>We've received your Rishikesh homestay enquiry. Our team will review your requirements and get back to you within 24 hours with personalized recommendations.</p>
          <p><strong>Your Submission Details:</strong></p>
          <ul>
            <li>Phone: ${data.phone}</li>
            ${data.check_in ? `<li>Check-in: ${data.check_in}</li>` : ''}
            ${data.check_out ? `<li>Check-out: ${data.check_out}</li>` : ''}
            <li>Preferred Area: ${data.area || 'Open to suggestions'}</li>
            <li>Trip Details: ${data.details.substring(0, 100)}...</li>
          </ul>
          <p>In the meantime, feel free to call us directly:</p>
          <p>
            📱 +91 9027212484<br>
            📱 +91 8050091290<br>
            💬 <a href="https://wa.me/919027212484">WhatsApp us</a>
          </p>
          <p>Warm regards,<br><strong>Rishikesh Homestays Team</strong></p>
        </div>
      `;

      await resend.emails.send({
        from: 'hello@rishikeshhomestays.com',
        to: data.email,
        subject: 'We received your Rishikesh homestay enquiry!',
        html: confirmationHtml
      });

      console.log("✅ Confirmation email sent to guest");
    }

    return res.json({
      success: true,
      message: "Thank you! We will contact you shortly.",
      enquiryId
    });

  } catch (error) {
    console.error("Error processing enquiry:", error.message);
    return res.status(500).json({
      success: false,
      message: "We encountered an error. Please try again or contact us directly."
    });
  }
}
