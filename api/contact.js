import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {

    if (req.method !== "POST") {
        return res.status(405).json({
            success: false
        });
    }

    try {

        const data = req.body;

        await supabase
            .from("enquiries")
            .insert({

                name: data.name,

                email: data.email,

                phone: data.phone,

                check_in: data.check_in,

                check_out: data.check_out,

                adults: data.adults,

                children: data.children,

                guests: data.guests,

                property: data.property,

                message: data.message,

                ip_address:
                    req.headers["x-forwarded-for"],

                user_agent:
                    req.headers["user-agent"]

            });

        await resend.emails.send({

            from:
                "Rishikesh Homestays <hello@rishikeshhomestays.com>",

            to: process.env.CONTACT_EMAIL,

            subject:
                `New enquiry from ${data.name}`,

            html: `

<h2>New Website Enquiry</h2>

<p><b>Name:</b> ${data.name}</p>

<p><b>Email:</b> ${data.email}</p>

<p><b>Phone:</b> ${data.phone}</p>

<p><b>Guests:</b> ${data.guests}</p>

<p><b>Check In:</b> ${data.check_in}</p>

<p><b>Check Out:</b> ${data.check_out}</p>

<p><b>Property:</b> ${data.property}</p>

<p><b>Message:</b></p>

<p>${data.message}</p>

`

        });

        return res.json({

            success: true

        });

    }

    catch (err) {

        console.log(err);

        return res.status(500).json({

            success: false,

            message: err.message

        });

    }

}
