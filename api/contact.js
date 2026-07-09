import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
      message: "Please complete the required fields before sending your inquiry."
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
    
    // Prepare inquiry data mapping form fields to table columns
    const inquiryData = {
      name: data.name,
      email: data.email || null,
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
      source: 'website_form',
      status: 'pending',
      ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress || null,
      user_agent: req.headers['user-agent'] || null,
      referrer: req.headers['referer'] || null
    };

    // Store in Supabase
    const { data: insertedData, error: dbError } = await supabase
      .from('enquiries')
      .insert([inquiryData])
      .select();

    if (dbError) {
      console.error("Supabase error:", dbError);
      throw new Error(`Database error: ${dbError.message}`);
    }

    console.log("✅ Data stored in Supabase:", insertedData);

    // Send email via Resend with tabular format
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">New Rishikesh Homestay Inquiry</h2>
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
            <td style="padding: 12px; border: 1px solid #ddd;">${data.email || 'Not provided'}</td>
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
        <p style="color: #666; margin-top: 20px; font-size: 12px;">This inquiry has been logged in your database.</p>
      </div>
    `;

    const emailResponse = await resend.emails.send({
      from: 'noreply@rishikeshhomestays.com',
      to: 'hello@rishikeshhomestays.com',
      subject: `New Inquiry from ${data.name} - Rishikesh Homestay`,
      html: emailHtml
    });

    console.log("✅ Email sent via Resend:", emailResponse);

    // Send confirmation email to guest if email provided
    if (data.email) {
      const confirmationHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Thank You! Your Inquiry is Received</h2>
          <p>Hi ${data.name},</p>
          <p>We've received your Rishikesh homestay inquiry. Our team will review your requirements and get back to you within 24 hours with personalized recommendations.</p>
          <p><strong>Your Submission Details:</strong></p>
          <ul>
            <li>Phone: ${data.phone}</li>
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
        subject: 'We received your Rishikesh homestay inquiry!',
        html: confirmationHtml
      });

      console.log("✅ Confirmation email sent to guest");
    }

    return res.json({
      success: true,
      message: "Thank you! We will contact you shortly.",
      inquiryId: insertedData?.[0]?.id
    });

  } catch (error) {
    console.error("Error processing inquiry:", error.message);
    return res.status(500).json({
      success: false,
      message: "We encountered an error. Please try again or contact us directly."
    });
  }
}
