const form =
document.querySelector("#contactForm");

form.addEventListener("submit", async function (e) {

    e.preventDefault();

    const btn =
    form.querySelector("button");

    btn.disabled = true;

    btn.innerText = "Sending...";

    const formData =
    Object.fromEntries(
        new FormData(form)
    );

    const response =
    await fetch("/api/contact", {

        method: "POST",

        headers: {
            "Content-Type":
                "application/json"
        },

        body:
            JSON.stringify(formData)

    });

    const result =
    await response.json();

    if (result.success) {

        alert(
            "Thank you! We will contact you shortly."
        );

        form.reset();

    }
    else {

        alert(result.message);

    }

    btn.disabled = false;

    btn.innerText = "Send";

});
