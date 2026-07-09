// Attach to the site's contact form and POST a JSON payload to the API
const form = document.querySelector("form[name='main-inquiry']") || document.querySelector("#contactForm") || document.querySelector(".booking-form");

if (form) {
    form.addEventListener("submit", async function (e) {
        e.preventDefault();

        const btn = form.querySelector("button[type='submit']") || form.querySelector("button");
        const originalText = btn ? btn.innerText : "Submit";

        if (btn) {
            btn.disabled = true;
            btn.innerText = "Sending...";
        }

        const raw = Object.fromEntries(new FormData(form));

        const payload = {
            name: raw.name || "",
            email: raw.email || "",
            phone: raw.phone || raw.whatsapp || "",
            property: raw.preferred_stay || raw.property || "",
            area: raw.area || "",
            message: raw.details || raw.message || ""
        };

        try {
            const response = await fetch("/api/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const result = await response.json().catch(() => ({}));

            if (response.ok && result.success !== false) {
                alert("Thank you! We will contact you shortly.");
                form.reset();
                // keep user on page or redirect to thanks
                window.location.href = "/pages/thanks.html";
            } else {
                alert(result.message || "Sorry, something went wrong. Please try again.");
            }
        } catch (err) {
            console.error(err);
            alert("Network error — please try again later.");
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerText = originalText;
            }
        }
    });
}
