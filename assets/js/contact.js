// Number counters
const counterButtons = document.querySelectorAll('.counter-btn');
counterButtons.forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const counterName = btn.dataset.counter;
    const action = btn.dataset.action;
    const input = document.querySelector(`#${counterName}`);
    let value = parseInt(input.value) || 0;
    const min = parseInt(input.min) || 0;
    const max = parseInt(input.max) || 999;

    if (action === 'increase') {
      value = Math.min(value + 1, max);
    } else if (action === 'decrease') {
      value = Math.max(value - 1, min);
    }

    input.value = value;
  });
});

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

    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    // Pets value already comes from radio button selection (none/dogs/cats)
    // pet_count is automatically included from the form
    
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (result.success) {
        form.reset();
        // Reset counters after submit
        document.getElementById('adults').value = 1;
        document.getElementById('children').value = 0;
        document.getElementById('pet_count').value = 0;
        
        if (status) {
          status.textContent = result.message || "Thank you! We will contact you shortly.";
          status.style.color = "#4CAF50";
        }
      } else {
        if (status) {
          status.textContent = result.message || "Unable to send your inquiry right now.";
          status.style.color = "#f44336";
        }
      }
    } catch (error) {
      if (status) {
        status.textContent = "Unable to send your inquiry right now. Please call us directly.";
        status.style.color = "#f44336";
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Request shortlist";
      }
    }
  });
}
