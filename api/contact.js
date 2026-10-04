import 'dotenv/config';
import { Resend } from 'resend';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { validateDateRange, validateRentalDateRange } from '../assets/js/modules/validators.js';
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

  // Bike/taxi rental enquiries (/bike-and-taxi-rental-in-rishikesh) send
  // their start/end dates as check_in/check_out; a rental may start and end
  // on the same day, so they get the looser end >= start check.
  const isRental = data.source === 'rental_enquiry';
  const dateRangeResult = isRental
    ? validateRentalDateRange(data.check_in, data.check_out)
    : validateDateRange(data.check_in, data.check_out);
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
    const rentalPeople = isRental ? parseInt(data.people) || 0 : 0;
    const adults = isRental ? rentalPeople || 1 : parseInt(data.adults) || 1;
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
      guests: isRental
        ? (rentalPeople ? `${rentalPeople} ${rentalPeople === 1 ? 'person' : 'people'}` : null)
        : parseInt(data.guests_total) > 0
        ? `${parseInt(data.guests_total)} guest(s) in total incl. kids`
        : `${adults} adult(s), ${children} child(ren)${petCount > 0 ? ', ' + petCount + ' pet(s)' : ''}`,
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

    // Send email via Resend. Wrapped in a branded header/footer (logo, brand
    // colors) instead of a bare unstyled div, since this is a guest-facing
    // moment too now (see the combined email below), not just an internal
    // notice — a well-designed confirmation reads as more trustworthy than
    // a plain data dump.
    const isHostApplication = data.source === 'host_application';
    // Leads from the "Book this stay" popup on /stay pages (stay_redirect_*,
    // stay_enquiry) are for our awareness only: never email the guest, even
    // if they typed an address.
    const isStayLead = String(data.source || '').startsWith('stay_');
    const totalGuests = parseInt(data.guests_total) || 0;
    const contactEmail = process.env.CONTACT_EMAIL || 'hello@rishikeshhomestays.com';
    const LOGO_URL = 'https://rishikeshhomestays.com/assets/images/logo.png';
    const BRAND_DARK = '#0f2f2b';
    const BRAND = '#14524a';
    const BRAND_LIGHT = '#e7f1ef';

    const row = (label, value) => `
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #66726f; font-size: 13px; width: 40%; vertical-align: top;">${label}</td>
            <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #17211f; font-size: 14px; font-weight: 600; vertical-align: top;">${value}</td>
          </tr>`;

    // Rentals show service/pickup/people instead of the stay-specific rows.
    const rentalService = data.service || 'Bike / taxi';
    const rentalRowsHtml = `
          ${row('Name', data.name)}
          ${row('Phone', data.phone)}
          ${row('Email', data.email || 'Not provided')}
          ${row('Service', rentalService)}
          ${row('Start date', data.check_in || 'Not specified')}
          ${row('End date', data.check_out || 'Not specified')}
          ${row('Pickup point', data.pickup_point || 'Not specified')}
          ${row('People', rentalPeople || 'Not specified')}
          ${row('Details', `<span style="font-weight: 400; white-space: pre-wrap;">${data.details}</span>`)}
          ${row('Submitted At', new Date().toLocaleString())}`;

    const detailsCardHtml = isRental ? `
        <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 22px 0; background: #fbfaf5; border: 1px solid #ded8ca; border-radius: 12px; padding: 4px 18px;">
          ${rentalRowsHtml}
        </table>` : `
        <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 22px 0; background: #fbfaf5; border: 1px solid #ded8ca; border-radius: 12px; padding: 4px 18px;">
          ${row('Name', data.name)}
          ${row('Phone', data.phone)}
          ${row('Email', `${data.email || 'Not provided'}${data.email ? (enquiryData.email_verified ? ' ✅ Verified' : ' (not verified)') : ''}`)}
          ${row('Check-in', data.check_in || 'Not specified')}
          ${row('Check-out', data.check_out || 'Not specified')}
          ${row('Preferred Property', data.preferred_stay || 'Open to suggestions')}
          ${row('Preferred Area', data.area || 'Not specified')}
          ${row('Coming from (City)', data.coming_from_city || 'Not specified')}
          ${row('Guests', totalGuests ? `${totalGuests} in total (kids included)` : `${adults} adult(s), ${children} child(ren)`)}
          ${row('Pets', petCount > 0 ? `${petType} (${petCount})` : 'None')}
          ${row('Trip Details', `<span style="font-weight: 400; white-space: pre-wrap;">${data.details}</span>`)}
          ${row('Submitted At', new Date().toLocaleString())}
        </table>`;

    const whatsappCtaHtml = `
        <table role="presentation" style="width: 100%; margin: 26px 0;"><tr><td align="center">
          <a href="https://wa.me/918050091290" style="display: inline-block; background: #25D366; color: #fff; text-decoration: none; font-weight: 700; font-size: 15px; padding: 14px 30px; border-radius: 999px;">💬 Chat with us on WhatsApp</a>
        </td></tr></table>
        <p style="text-align: center; color: #66726f; font-size: 13px; margin: 0 0 4px;">or call us directly</p>
        <p style="text-align: center; color: #17211f; font-size: 14px; font-weight: 600; margin: 0;">+91 90272 12484 &nbsp;·&nbsp; +91 80500 91290</p>`;

    // Shared header/footer chrome — every email from the site looks like it
    // came from the same place, guest-facing or internal.
    // A custom hand-drawn illustration would need a hosted image asset we
    // don't have yet, and SVG is unreliable across email clients anyway —
    // an emoji "skyline" motif gets the same hand-drawn, illustrated warmth
    // cheaply, renders everywhere (Gmail, Outlook, Apple Mail alike), and
    // needs no asset hosting or dark-mode handling.
    const skylineHtml = `
        <div style="text-align: center; font-size: 26px; letter-spacing: 6px; padding: 14px 0 2px; opacity: 0.9;">🏔️⛰️🛖🌊🛖⛰️🏔️</div>`;

    const emailShell = (bodyHtml) => `
      <div style="font-family: -apple-system, 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #ede8dc;">
        <div style="background: linear-gradient(135deg, ${BRAND} 0%, ${BRAND_DARK} 100%); padding: 28px 32px; text-align: center;">
          <img src="${LOGO_URL}" width="84" height="84" alt="Rishikesh Homestays" style="border-radius: 50%; background: #fff; padding: 6px; display: inline-block;">
          <div style="color: #fff; font-size: 19px; font-weight: 700; margin-top: 12px; letter-spacing: 0.02em;">Rishikesh Homestays</div>
          <div style="color: #cfe8e2; font-size: 13px; font-weight: 600; margin-top: 4px;">You've found your Ganges getaway 🎉</div>
        </div>
        ${skylineHtml}
        <div style="padding: 8px 32px 32px;">
          ${bodyHtml}
        </div>
        <div style="background: ${BRAND_LIGHT}; padding: 18px 32px; text-align: center; color: #45534f; font-size: 12px;">
          Handpicked homestays near the Ganges, Tapovan &amp; Triveni Ghat<br>
          <a href="https://rishikeshhomestays.com" style="color: ${BRAND}; font-weight: 600; text-decoration: none;">rishikeshhomestays.com</a>
        </div>
      </div>`;

    // A little personality + a reason to book direct rather than through an
    // OTA — guest-facing only, since it's a booking pitch, not something an
    // internal "new enquiry" alert needs.
    const bookDirectApppealHtml = `
        <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 22px 0; background: ${BRAND_LIGHT}; border-radius: 12px;"><tr><td style="padding: 18px 20px;">
          <p style="margin: 0 0 6px; color: ${BRAND}; font-weight: 800; font-size: 14px;">🌤️ Psst — a little insider tip</p>
          <p style="margin: 0; color: #314b47; font-size: 14px; line-height: 1.6;">Book directly with us (like you just did!) and there's no middleman fee baked into your price — plus you get a real human on WhatsApp who actually knows the ghats, the good chai stalls, and which room has the best sunrise view. Airbnb can't tell you that. 😉</p>
        </td></tr></table>`;

    // One-tap reply for us: opens WhatsApp to the guest's number with a
    // friendly opener about the stay they asked for.
    const guestWaDigits = String(data.phone || '').replace(/\D/g, '');
    const stayName = data.stay_name || data.preferred_stay || 'your Rishikesh stay';
    // Deliberately doesn't name the listing they clicked: the goal is to steer
    // them to our own homestay network, so just ask for dates and offer picks.
    // The book-direct pitch ends with one random way to enjoy the commission
    // they save by not booking through a platform.
    const SAVED_COMMISSION_IDEAS = [
      'a proper feast at Chotiwala',
      'a white-water rafting trip on the Ganga',
      'an offering at the Triveni Ghat aarti',
      'a donation at Triveni Ghat',
      'a sunrise yoga class by the river',
      'kulhad chai and hot jalebis by the ghat, every evening',
      'a sunrise taxi up to Kunjapuri Devi',
      'a diya (or ten) at the Parmarth Niketan aarti',
      'an Ayurvedic massage after the trek',
      'a cafe crawl through Tapovan'
    ];
    const savedIdea = SAVED_COMMISSION_IDEAS[Math.floor(Math.random() * SAVED_COMMISSION_IDEAS.length)];
    const guestOpener = isRental
      ? `Hi ${data.name}! 🙏 This is Rishikesh Homestays. Thanks for your ${rentalService} enquiry. ` +
        'We\'re checking with our local partners and will share the options and a quote shortly. ' +
        'Need a place to stay too? We can line up one of our handpicked homestays near your pickup. 🌊'
      : `Hi ${data.name}! 🙏 This is Rishikesh Homestays. Thanks for reaching out about your Rishikesh trip` +
      `${totalGuests ? ` for ${totalGuests} guest${totalGuests > 1 ? 's' : ''}` : ''}. ` +
      'Could you share your check-in and check-out dates? We\'ll line up our best handpicked homestays and hotels for you. ' +
      `Book direct with us and skip the booking-site commission. Spend what you save on ${savedIdea} instead! 🌊`;
    const replyOnWhatsAppHtml = guestWaDigits ? `
        <table role="presentation" style="width: 100%; margin: 6px 0 18px;"><tr><td align="center">
          <a href="https://wa.me/${guestWaDigits}?text=${encodeURIComponent(guestOpener)}" style="display: inline-block; background: #25D366; color: #fff; text-decoration: none; font-weight: 700; font-size: 15px; padding: 14px 30px; border-radius: 999px;">💬 WhatsApp ${data.name} now</a>
        </td></tr></table>
        <p style="text-align: center; color: #66726f; font-size: 12px; margin: 0 0 8px;">Opens a chat with ${data.phone}, with a ready-to-send opener you can edit.</p>` : '';

    const rentalSubject = `Rental enquiry: ${data.name} → ${rentalService}`;

    if (data.email && !isStayLead) {
      // One shared thread instead of two disconnected emails: the guest is
      // the primary recipient (so it reads as "your enquiry", not an
      // internal notice) and we're CC'd on the same message, so replying
      // all keeps guest and owner in the same conversation from message one.
      const greetingHtml = `
          <h1 style="color: ${BRAND}; font-size: 22px; margin: 0 0 6px;">${isHostApplication ? `Thanks, ${data.name}! Let's get your homestay listed 🏡` : isRental ? `Thanks, ${data.name}! Your wheels are being lined up 🛵` : `Thanks, ${data.name} — your Rishikesh trip is taking shape! 🌊`}</h1>
          <p style="color: #45534f; font-size: 15px; line-height: 1.6; margin: 0 0 4px;">${isHostApplication
            ? "We've received your application to list your property with us — there's no listing fee. Our team will review your details and reach out within 24 hours to confirm next steps."
            : isRental
            ? "We've got your rental enquiry and we're checking it with our trusted local partners. Expect a call or WhatsApp from us shortly with options and a quote. Helmets on, playlist ready 🏔️"
            : "We've got your enquiry and we're already matching it against our handpicked homestays. Expect personalized recommendations from our team within 24 hours — pack your sense of adventure (and maybe some flip-flops for the ghats) 🏔️"}</p>
          ${detailsCardHtml}
          ${isHostApplication || isRental ? '' : bookDirectApppealHtml}
          ${whatsappCtaHtml}
          <p style="color: #45534f; font-size: 14px; margin: 26px 0 0;">Warm regards,<br><strong style="color: #17211f;">Rishikesh Homestays Team</strong></p>`;

      const emailResponse = await resend.emails.send({
        from: 'hello@rishikeshhomestays.com',
        to: data.email,
        cc: contactEmail,
        subject: isHostApplication
          ? 'Your Rishikesh Homestays listing application is received'
          : isRental
            ? rentalSubject
            : 'We received your Rishikesh homestay enquiry!',
        html: emailShell(greetingHtml)
      });

      console.log("✅ Combined guest+owner email sent via Resend:", emailResponse);
    } else {
      // No guest email to make the primary recipient — just notify us
      // internally, same branded shell but framed as an internal alert.
      const internalHtml = `
          <h1 style="color: ${BRAND}; font-size: 20px; margin: 0 0 6px;">${isHostApplication ? 'New Homestay Listing Application' : isRental ? `New rental enquiry: ${rentalService}` : isStayLead ? `New stay lead: ${stayName}` : 'New Rishikesh Homestay Enquiry'}</h1>
          <p style="color: #66726f; font-size: 14px; margin: 0 0 4px;">${isStayLead
            ? `For your eyes only: the guest was not emailed.${data.source.startsWith('stay_redirect_') ? ' They were sent on to the booking site after this.' : ''}`
            : 'No email on file for this guest — reach out by phone or WhatsApp.'}</p>
          ${replyOnWhatsAppHtml}
          ${detailsCardHtml}
          <p style="color: #66726f; font-size: 12px; margin-top: 20px;">This enquiry has been logged in your database.</p>`;

      const emailResponse = await resend.emails.send({
        from: 'noreply@rishikeshhomestays.com',
        to: contactEmail,
        subject: isHostApplication
          ? `New Listing Application from ${data.name} - Rishikesh Homestays`
          : isRental
            ? rentalSubject
            : isStayLead
            ? `Stay lead: ${data.name}${totalGuests ? ` (${totalGuests} guests)` : ''} → ${stayName}`
            : `New Enquiry from ${data.name} - Rishikesh Homestay`,
        html: emailShell(internalHtml)
      });

      console.log("✅ Email sent via Resend:", emailResponse);
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
