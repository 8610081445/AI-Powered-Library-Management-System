const express = require("express");
const router = express.Router();
const transactionController = require("../controllers/transactionController");

router.get("/", transactionController.getAllTransactions);
router.get("/active", transactionController.getActiveLoans);
router.post("/issue", transactionController.issueBook);
router.post("/return", transactionController.returnBook);
router.post("/return/:id", transactionController.returnBook);
router.post("/renew/:id", transactionController.renewLoan);
router.post("/pay-fine/:id", transactionController.payFine);

module.exports = router;
