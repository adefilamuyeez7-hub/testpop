import express from "express";
import { verifyApiBearerToken, verifyAuthToken } from "../requestAuth.js";
import {
  broadcastCreatorThreads,
  createProductFeedbackMessage,
  createItemFeedbackThread,
  createProductFeedbackThread,
  createChannel,
  createOrOpenThread,
  createPost,
  createThreadMessage,
  curateProductFeedbackThread,
  getFanHubOverview,
  getItemFeedback,
  getProductFeedback,
  getProductFeedbackThreadMessages,
  getThreadMessages,
} from "../services/fanHub.js";

const router = express.Router();

router.get("/overview", verifyAuthToken, async (req, res) => {
  try {
    const overview = await getFanHubOverview(req.user.wallet);
    return res.json({ success: true, overview });
  } catch (error) {
    console.error("Failed to load fan hub overview:", error);
    return res.status(500).json({ error: error.message || "Failed to load fan hub overview" });
  }
});

router.post("/channels", verifyAuthToken, async (req, res) => {
  try {
    const channel = await createChannel({
      wallet: req.user.wallet,
      artistId: req.body?.artistId,
      name: req.body?.name,
      description: req.body?.description,
      accessLevel: req.body?.accessLevel || "public",
    });

    return res.json({ success: true, channel });
  } catch (error) {
    console.error("Failed to create creator channel:", error);
    return res.status(400).json({ error: error.message || "Failed to create creator channel" });
  }
});

router.post("/posts", verifyAuthToken, async (req, res) => {
  try {
    const post = await createPost({
      wallet: req.user.wallet,
      artistId: req.body?.artistId,
      channelId: req.body?.channelId,
      title: req.body?.title,
      body: req.body?.body,
      postKind: req.body?.postKind || "update",
    });

    return res.json({ success: true, post });
  } catch (error) {
    console.error("Failed to create creator post:", error);
    return res.status(400).json({ error: error.message || "Failed to create creator post" });
  }
});

router.post("/threads", verifyAuthToken, async (req, res) => {
  try {
    const thread = await createOrOpenThread({
      wallet: req.user.wallet,
      artistId: req.body?.artistId,
      fanWallet: req.body?.fanWallet,
      subject: req.body?.subject,
      body: req.body?.body,
    });

    return res.json({ success: true, thread });
  } catch (error) {
    console.error("Failed to create or open thread:", error);
    return res.status(400).json({ error: error.message || "Failed to create or open thread" });
  }
});

router.post("/threads/broadcast", verifyAuthToken, async (req, res) => {
  try {
    const result = await broadcastCreatorThreads({
      wallet: req.user.wallet,
      artistId: req.body?.artistId,
      audience: req.body?.audience,
      subject: req.body?.subject,
      body: req.body?.body,
    });

    return res.json({ success: true, result });
  } catch (error) {
    console.error("Failed to broadcast creator threads:", error);
    return res.status(400).json({ error: error.message || "Failed to broadcast creator threads" });
  }
});

router.get("/threads/:threadId/messages", verifyAuthToken, async (req, res) => {
  try {
    const thread = await getThreadMessages({
      wallet: req.user.wallet,
      threadId: req.params.threadId,
    });

    return res.json({ success: true, thread });
  } catch (error) {
    console.error("Failed to load thread messages:", error);
    return res.status(400).json({ error: error.message || "Failed to load thread messages" });
  }
});

router.post("/threads/:threadId/messages", verifyAuthToken, async (req, res) => {
  try {
    const message = await createThreadMessage({
      wallet: req.user.wallet,
      threadId: req.params.threadId,
      body: req.body?.body,
    });

    return res.json({ success: true, message });
  } catch (error) {
    console.error("Failed to send thread message:", error);
    return res.status(400).json({ error: error.message || "Failed to send thread message" });
  }
});

router.get("/products/:productId/feedback", async (req, res) => {
  let wallet = "";

  try {
    if (req.headers.authorization) {
      wallet = verifyApiBearerToken(req.headers.authorization).wallet;
    }
  } catch (_error) {
    wallet = "";
  }

  try {
    const feedback = await getProductFeedback(req.params.productId, wallet);
    return res.json({ success: true, feedback });
  } catch (error) {
    console.error("Failed to load product feedback:", error);
    return res.status(400).json({ error: error.message || "Failed to load product feedback" });
  }
});

router.post("/products/:productId/feedback", verifyAuthToken, async (req, res) => {
  try {
    const thread = await createProductFeedbackThread({
      wallet: req.user.wallet,
      productId: req.params.productId,
      feedbackType: req.body?.feedbackType,
      visibility: req.body?.visibility,
      rating: req.body?.rating,
      title: req.body?.title,
      body: req.body?.body,
    });

    return res.json({ success: true, thread });
  } catch (error) {
    console.error("Failed to create product feedback thread:", error);
    return res.status(400).json({ error: error.message || "Failed to create product feedback thread" });
  }
});

router.get("/items/:itemType/:itemId/feedback", async (req, res) => {
  let wallet = "";

  try {
    if (req.headers.authorization) {
      wallet = verifyApiBearerToken(req.headers.authorization).wallet;
    }
  } catch (_error) {
    wallet = "";
  }

  try {
    const feedback = await getItemFeedback(req.params.itemType, req.params.itemId, wallet);
    return res.json({ success: true, feedback });
  } catch (error) {
    console.error("Failed to load item feedback:", error);
    return res.status(400).json({ error: error.message || "Failed to load item feedback" });
  }
});

router.post("/items/:itemType/:itemId/feedback", verifyAuthToken, async (req, res) => {
  try {
    const thread = await createItemFeedbackThread({
      wallet: req.user.wallet,
      itemType: req.params.itemType,
      itemId: req.params.itemId,
      feedbackType: req.body?.feedbackType,
      visibility: req.body?.visibility,
      rating: req.body?.rating,
      title: req.body?.title,
      body: req.body?.body,
    });

    return res.json({ success: true, thread });
  } catch (error) {
    console.error("Failed to create item feedback thread:", error);
    return res.status(400).json({ error: error.message || "Failed to create item feedback thread" });
  }
});

router.get("/product-feedback/:threadId/messages", async (req, res) => {
  let wallet = "";

  try {
    if (req.headers.authorization) {
      wallet = verifyApiBearerToken(req.headers.authorization).wallet;
    }
  } catch (_error) {
    wallet = "";
  }

  try {
    const thread = await getProductFeedbackThreadMessages({
      wallet,
      threadId: req.params.threadId,
    });

    return res.json({ success: true, thread });
  } catch (error) {
    console.error("Failed to load product feedback thread:", error);
    return res.status(400).json({ error: error.message || "Failed to load product feedback thread" });
  }
});

router.post("/product-feedback/:threadId/messages", verifyAuthToken, async (req, res) => {
  try {
    const message = await createProductFeedbackMessage({
      wallet: req.user.wallet,
      threadId: req.params.threadId,
      body: req.body?.body,
    });

    return res.json({ success: true, message });
  } catch (error) {
    console.error("Failed to send product feedback message:", error);
    return res.status(400).json({ error: error.message || "Failed to send product feedback message" });
  }
});

router.patch("/product-feedback/:threadId/curate", verifyAuthToken, async (req, res) => {
  try {
    const thread = await curateProductFeedbackThread({
      wallet: req.user.wallet,
      threadId: req.params.threadId,
      featured: req.body?.featured,
      creatorCurated: req.body?.creatorCurated,
      status: req.body?.status,
      visibility: req.body?.visibility,
      title: req.body?.title,
    });

    return res.json({ success: true, thread });
  } catch (error) {
    console.error("Failed to curate product feedback thread:", error);
    return res.status(400).json({ error: error.message || "Failed to curate product feedback thread" });
  }
});

export default router;
