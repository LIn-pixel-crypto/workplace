import { PaymentLink, InsertPaymentLink } from "@shared/schema";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";

interface ErrorResponse {
  error: string;
  code?: string;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message) as ErrorResponse;
      return parsed.error || error.message;
    } catch {
      return error.message;
    }
  }
  return '发生了意外错误';
}

// WebSocket连接管理
let ws: WebSocket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 1000;

function connectWebSocket() {
  if (ws?.readyState === WebSocket.OPEN) return;

  if (ws?.readyState === WebSocket.CONNECTING) {
    return;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket连接已建立');
      reconnectAttempts = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'payment_link_update') {
          queryClient.invalidateQueries({ queryKey: ["/api/payment-links"] });
        }
      } catch (error) {
        console.error('处理WebSocket消息时出错:', error);
      }
    };

    ws.onclose = (event) => {
      console.log('WebSocket连接已关闭:', event.code, event.reason);
      ws = null;

      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        const delay = RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1);
        console.log(`尝试重新连接 (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) 在 ${delay}ms 后...`);
        setTimeout(connectWebSocket, delay);
      }
    };

    ws.onerror = (event) => {
      console.error('WebSocket错误:', event);
    };
  } catch (error) {
    console.error('创建WebSocket连接时出错:', error);
  }
}

export function usePaymentLinks() {
  const { toast } = useToast();

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
        ws = null;
      }
    };
  }, []);

  const {
    data: links = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["/api/payment-links"],
    retry: 3,
    staleTime: 1000,
    gcTime: 5 * 60 * 1000,
  });

  const createLink = useMutation({
    mutationFn: async (link: InsertPaymentLink) => {
      const res = await apiRequest("POST", "/api/payment-links", link);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || '创建支付链接失败');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-links"] });
      toast({
        title: "成功",
        description: "支付链接创建成功",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "创建支付链接错误",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const renewLink = useMutation({
    mutationFn: async ({ id, url }: { id: number; url: string }) => {
      console.log('尝试更新支付链接:', { id, url });
      const res = await apiRequest("POST", `/api/payment-links/${id}/renew`, { url });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || '更新支付链接失败');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-links"] });
      toast({
        title: "成功",
        description: "支付链接更新成功",
      });
    },
    onError: (error: Error) => {
      console.error('更新支付链接失败:', error);
      toast({
        title: "更新支付链接错误",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const deleteLink = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/payment-links/${id}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || '删除支付链接失败');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-links"] });
      toast({
        title: "成功",
        description: "支付链接删除成功",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "删除支付链接错误",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const archiveLink = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/payment-links/${id}/archive`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || '归档支付链接失败');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-links"] });
      toast({
        title: "成功",
        description: "支付链接归档成功",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "归档支付链接错误",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const checkStatus = useMutation({
    mutationFn: async (id: number) => {
      console.log('检查支付状态:', id);
      const res = await apiRequest("POST", `/api/payment-links/${id}/check`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || '检查支付状态失败');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-links"] });
    },
    onError: (error: Error) => {
      const errorMessage = getErrorMessage(error);
      if (!errorMessage.includes('NOT_FOUND')) {
        toast({
          title: "检查支付状态错误",
          description: errorMessage,
          variant: "destructive",
        });
      }
      throw error;
    },
  });

  return {
    links: links as PaymentLink[],
    isLoading,
    error,
    createLink: createLink.mutate,
    renewLink: renewLink.mutate,
    deleteLink: deleteLink.mutate,
    archiveLink: archiveLink.mutate,
    checkStatus: checkStatus.mutateAsync,
  };
}