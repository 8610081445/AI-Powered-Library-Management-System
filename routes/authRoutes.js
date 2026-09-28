const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

router.post("/login", authController.login);
router.post("/register", authController.register);
router.get("/me", authController.getMe);
router.put("/profile", authController.updateProfile);
router.post("/logout", authController.logout);

module.exports = router;
