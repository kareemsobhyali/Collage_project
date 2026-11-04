import { Router, Request, Response } from "express";
import { smsGatewayService } from "../services/smsGateway.service.js";
import { requireSuperAdmin } from "../middleware/auth.js";

const router = Router();

/**
 * ميدلوير للتحقق من مفتاح الجهاز السري المرسل من تطبيق الأندرويد
 */
const authenticateGatewayDevice = async (req: Request, res: Response, next: Function) => {
  const deviceKey = (
    req.headers["x-gateway-key"] ||
    req.headers["x-device-key"] ||
    req.query.deviceKey ||
    req.body.deviceKey ||
    ""
  ).toString().trim();

  if (!deviceKey) {
    res.status(401).json({ error: "مفتاح الجهاز السري غير مزود (Unauthorized Gateway Device)" });
    return;
  }

  const device = await smsGatewayService.verifyDevice(deviceKey);
  if (!device || !device.isActive) {
    res.status(403).json({ error: "مفتاح الجهاز غير صالح أو تم إيقاف الجهاز من الإدارة" });
    return;
  }

  (req as any).gatewayDevice = device;
  next();
};

// 1. استرجاع إعدادات وقنوات التفعيل للعميل
router.get("/config", async (_req: Request, res: Response) => {
  try {
    const overview = await smsGatewayService.getGatewayOverview();
    const { whatsappService } = await import("../services/whatsapp.service.js");
    let isWhatsAppOnline = false;
    try {
      const statuses = await whatsappService.getAllAccountsStatus();
      isWhatsAppOnline = statuses.some((s: any) => s.isConnected && s.isActive && (s.sendOtp || s.isDefault));
    } catch {
      isWhatsAppOnline = false;
    }

    res.json({
      success: true,
      channelMode: overview.channelMode,
      isSmsGatewayOnline: overview.device.isOnline,
      isWhatsAppOnline,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "حدث خطأ أثناء جلب إعدادات قنوات التفعيل" });
  }
});

// 2. استقبال نبضة واتصال تطبيق الأندرويد (Heartbeat)
router.post("/device/heartbeat", authenticateGatewayDevice, async (req: Request, res: Response) => {
  try {
    const device = (req as any).gatewayDevice;
    const { batteryLevel, isCharging, simOperator, phoneNumber, appVersion } = req.body;

    const updated = await smsGatewayService.updateHeartbeat(device.deviceKey, {
      batteryLevel: typeof batteryLevel === "number" ? batteryLevel : undefined,
      isCharging: typeof isCharging === "boolean" ? isCharging : undefined,
      simOperator: simOperator ? String(simOperator) : undefined,
      phoneNumber: phoneNumber ? String(phoneNumber) : undefined,
      appVersion: appVersion ? String(appVersion) : undefined,
    });

    const pending = await smsGatewayService.getPendingMessages(10);

    res.json({
      success: true,
      device: updated,
      pendingCount: pending.length,
      pendingMessages: pending,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "فشل تسجيل نبضة الجهاز" });
  }
});

// 3. جلب الرسائل المعلقة لتطبيق الأندرويد (Pending Queue)
router.get("/device/pending", authenticateGatewayDevice, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const pending = await smsGatewayService.getPendingMessages(limit);
    res.json({
      success: true,
      count: pending.length,
      messages: pending,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "فشل جلب الرسائل المعلقة" });
  }
});

// 4. تسجيل تقرير نجاح أو فشل إرسال رسالة من هاتف الأندرويد
router.post("/device/report", authenticateGatewayDevice, async (req: Request, res: Response) => {
  try {
    const { logId, status, errorReason } = req.body;
    if (!logId || !status || !["SENT", "FAILED"].includes(status)) {
      res.status(400).json({ error: "معرف الرسالة وحالة الإرسال مطلوبان بشكل صحيح" });
      return;
    }

    const updated = await smsGatewayService.reportStatus(logId, status, errorReason);
    if (!updated) {
      res.status(404).json({ error: "لم يتم العثور على سجل الرسالة" });
      return;
    }

    res.json({
      success: true,
      message: status === "SENT" ? "تم تأكيد إرسال الرسالة بنجاح" : "تم تسجيل فشل الإرسال",
      log: updated,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "فشل تسجيل تقرير الإرسال" });
  }
});

// 5. لوحة الإدارة المركزية: نظرة عامة وإحصائيات بوابة الرسائل (Admin Overview)
router.get("/admin/overview", requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const data = await smsGatewayService.getGatewayOverview();
    res.json({
      success: true,
      ...data,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "فشل جلب بيانات بوابة الرسائل" });
  }
});

// 6. لوحة الإدارة: تحديث قناة التفعيل المفضلة (Channel Mode)
router.post("/admin/settings", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { channelMode } = req.body;
    if (!channelMode || !["USER_CHOICE", "WHATSAPP_ONLY", "SMS_ONLY", "WHATSAPP_FALLBACK_SMS"].includes(channelMode)) {
      res.status(400).json({ error: "نمط قناة التفعيل غير صالح" });
      return;
    }

    await smsGatewayService.setVerificationChannelMode(channelMode);
    res.json({
      success: true,
      channelMode,
      message: "تم تحديث إعدادات قنوات التفعيل بنجاح",
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "فشل تحديث الإعدادات" });
  }
});

// 7. لوحة الإدارة: تجديد مفتاح ربط الهاتف
router.post("/admin/regenerate-key", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.body;
    const device = await smsGatewayService.getOrCreateDefaultDevice();
    const updated = await smsGatewayService.regenerateDeviceKey(deviceId || device.id);

    res.json({
      success: true,
      device: updated,
      message: "تم تجديد مفتاح ربط الهاتف بنجاح",
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "فشل تجديد المفتاح" });
  }
});

// 8. لوحة الإدارة: إرسال رسالة SMS تجريبية
router.post("/admin/test-sms", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { phone, message } = req.body;
    if (!phone) {
      res.status(400).json({ error: "يرجى إدخال رقم الهاتف المراد إرسال الرسالة التجريبية إليه" });
      return;
    }

    const testMessage = message?.trim() || `رسالة تجريبية من منصة UniFood للتأكد من اتصال بوابة الرسائل SMS Gateway بنجاح! 🚀📱\nالوقت: ${new Date().toLocaleTimeString('ar-EG')}`;
    const result = await smsGatewayService.queueSms(phone, testMessage, "CUSTOM");

    res.json({
      message: "تم إدراج الرسالة التجريبية في طابور الإرسال وبثها لهاتفك المتصل!",
      ...result,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "فشل إرسال الرسالة التجريبية" });
  }
});

export default router;
