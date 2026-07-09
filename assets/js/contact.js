const form = document.querySelector("#contactForm");

if (form) {
  const btn = form.querySelector("button");
  const status = form.querySelector("[data-form-status]");

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (btn) {
      btn.disabled = true;
      btn.textContent = "Sending...";
    }

    if (status) {
      status.textContent = "";
    }

    const formData = Object.fromEntries(new FormData(form));

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (result.success) {
        form.reset();
        if (status) {
          status.textContent = result.message || "Thank you! We will contact you shortly.";
        }
      } else {
        if (status) {
          status.textContent = result.message || "Unable to send your inquiry right now.";
        }
      }
    } catch (error) {
      if (status) {
        status.textContent = "Unable to send your inquiry right now. Please call us directly.";
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Request shortlist";
      }
    }
  });
}
