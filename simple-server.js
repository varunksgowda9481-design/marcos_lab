const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Server is working!");
});

app.listen(3001, () => {
  console.log("Server running on http://localhost:3001");
});
