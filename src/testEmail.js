require("dotenv").config();
const sendEmail = require("./config/email");

(async () => {
  await sendEmail({
    to: "yourpersonalemail@gmail.com",
    subject: "Test Email",
    html: "<h1>Email works 🎉</h1>",
  });

  console.log("Email sent");
})();
