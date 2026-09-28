const express = require("express");
const router = express.Router();
const aiController = require("../controllers/aiController");

router.post("/semantic-search", aiController.semanticSearch);
router.post("/summarize", aiController.summarizeBook);
router.post("/recommend", aiController.getRecommendations);
router.post("/chat", aiController.chatAssistant);
router.post("/auto-catalog", aiController.autoCatalog);

module.exports = router;
