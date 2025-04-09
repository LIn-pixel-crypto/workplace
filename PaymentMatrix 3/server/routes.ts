import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertPaymentLinkSchema } from "@shared/schema";
import { PaymentLinkError, handleError } from "./errors";
import { WebSocket, WebSocketServer } from 'ws';

let wss: WebSocketServer;

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Create HTTP server first
  const httpServer = createServer(app);

  // Initialize WebSocket server
  wss = new WebSocketServer({ 
    server: httpServer,
    path: "/ws"
  });

  // WebSocket error handling
  wss.on('error', (error) => {
    console.error('WebSocket服务器错误:', error);
  });

  // 连接处理
  wss.on('connection', (ws) => {
    console.log('新的WebSocket连接已建立');

    ws.on('error', (error) => {
      console.error('WebSocket连接错误:', error);
    });

    ws.on('close', () => {
      console.log('WebSocket连接已关闭');
    });
  });

  // 注册API路由
  setupAPIRoutes(app);

  return httpServer;
}

function broadcastUpdate(type: string, data: any) {
  const message = JSON.stringify({ type, data });
  console.log('广播消息:', message);

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (error) {
        console.error('广播错误:', error);
      }
    }
  });
}

function setupAPIRoutes(app: Express) {
  // Payment Links API endpoints
  app.get("/api/payment-links", async (req, res) => {
    if (!req.isAuthenticated()) {
      console.log('未认证的请求');
      return res.sendStatus(401);
    }
    try {
      console.log('获取支付链接，用户ID:', req.user.id);
      const links = await storage.getPaymentLinks(req.user.id);
      res.json(links);
    } catch (error) {
      const appError = handleError(error);
      res.status(appError.statusCode).json({
        error: appError.message,
        code: appError.code
      });
    }
  });

  app.post("/api/payment-links", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const parsed = insertPaymentLinkSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new PaymentLinkError('无效的支付链接数据', 'VALIDATION_ERROR');
      }

      const link = await storage.createPaymentLink(req.user.id, parsed.data);
      broadcastUpdate('payment_link_update', {
        action: 'create',
        link
      });
      res.status(201).json(link);
    } catch (error) {
      const appError = handleError(error);
      res.status(appError.statusCode).json({
        error: appError.message,
        code: appError.code
      });
    }
  });

  app.delete("/api/payment-links/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { id } = req.params;
      await storage.deletePaymentLink(parseInt(id), req.user.id);
      broadcastUpdate('payment_link_update', {
        action: 'delete',
        linkId: parseInt(id)
      });
      res.sendStatus(204);
    } catch (error) {
      const appError = handleError(error);
      res.status(appError.statusCode).json({
        error: appError.message,
        code: appError.code
      });
    }
  });

  app.post("/api/payment-links/:id/check", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { id } = req.params;
      const links = await storage.getPaymentLinks(req.user.id);
      const link = links.find(l => l.id === parseInt(id));

      if (!link) {
        throw new PaymentLinkError('未找到支付链接', 'NOT_FOUND');
      }

      const checkResult = await checkPaymentPage(link.url);
      const updated = await storage.updatePaymentLinkStatus(
        link.id,
        checkResult.isActive ? "active" : "error",
        checkResult.errorCode,
        checkResult.transactionNo,
        checkResult.amountAED
      );

      broadcastUpdate('payment_link_update', {
        action: 'status_update',
        link: updated
      });
      res.json(updated);
    } catch (error) {
      const appError = handleError(error);
      res.status(appError.statusCode).json({
        error: appError.message,
        code: appError.code
      });
    }
  });

  app.post("/api/payment-links/:id/archive", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { id } = req.params;
      const archivedLink = await storage.archivePaymentLink(parseInt(id), req.user.id);
      broadcastUpdate('payment_link_update', {
        action: 'archive',
        link: archivedLink
      });
      res.json(archivedLink);
    } catch (error) {
      const appError = handleError(error);
      res.status(appError.statusCode).json({
        error: appError.message,
        code: appError.code
      });
    }
  });

  app.post("/api/payment-links/:id/renew", async (req, res) => {
    if (!req.isAuthenticated()) {
      console.log('未认证的续期请求');
      return res.sendStatus(401);
    }

    try {
      const { id } = req.params;
      const { url } = req.body;

      if (!url) {
        throw new PaymentLinkError('缺少新的支付链接URL', 'VALIDATION_ERROR');
      }

      console.log('尝试续期支付链接:', { id, url, userId: req.user.id });

      // 首先验证用户是否有权限操作此链接
      const links = await storage.getPaymentLinks(req.user.id);
      const link = links.find(l => l.id === parseInt(id));

      if (!link) {
        throw new PaymentLinkError('未找到支付链接', 'NOT_FOUND');
      }

      if (link.userId !== req.user.id) {
        throw new PaymentLinkError('无权操作此支付链接', 'UNAUTHORIZED');
      }

      // 更新URL
      const updated = await storage.updatePaymentLinkUrl(parseInt(id), url);
      console.log('URL更新成功:', updated);

      // 重置支付链接状态
      const resetLink = await storage.updatePaymentLinkStatus(
        parseInt(id),
        "active",
        null,
        null,
        null
      );

      console.log('支付链接续期成功:', resetLink);

      // 广播更新
      broadcastUpdate('payment_link_update', {
        action: 'renew',
        link: resetLink
      });

      res.json(resetLink);
    } catch (error) {
      console.error('续期过程中出错:', error);
      const appError = handleError(error);
      res.status(appError.statusCode).json({
        error: appError.message,
        code: appError.code
      });
    }
  });
}

async function checkPaymentPage(url: string): Promise<{
  isActive: boolean;
  transactionNo?: string;
  amountAED?: string;
  errorCode?: string;
}> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new PaymentLinkError(`获取支付页面失败: ${response.statusText}`, 'FETCH_ERROR');
    }

    const text = await response.text();

    if (text.includes("Sorry, something went wrong")) {
      return {
        isActive: false,
        errorCode: "发生错误",
      };
    }

    const transactionMatch = text.match(/SP Transaction No\s+(\d+)/);
    const amountMatch = text.match(/Amount\s+([\d,.]+)\s*AED/);

    if (!transactionMatch && !amountMatch) {
      throw new PaymentLinkError('无效的支付页面格式', 'INVALID_FORMAT');
    }

    return {
      isActive: true,
      transactionNo: transactionMatch?.[1],
      amountAED: amountMatch?.[1],
    };
  } catch (error) {
    if (error instanceof PaymentLinkError) {
      throw error;
    }
    throw new PaymentLinkError(
      `检查支付页面失败: ${error instanceof Error ? error.message : '未知错误'}`,
      'CHECK_ERROR'
    );
  }
}