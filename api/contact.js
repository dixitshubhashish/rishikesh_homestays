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

  console.log("New inquiry received", {
    name: data.name,
    email: data.email,
    phone: data.phone,
    preferredStay: data.preferred_stay,
    area: data.area,
    details: data.details,
    receivedAt: new Date().toISOString()
  });

  return res.json({
    success: true,
    message: "Thank you! We will contact you shortly."
  });
}
