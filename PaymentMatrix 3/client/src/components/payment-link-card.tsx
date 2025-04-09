import { PaymentLink } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AlertCircle, CheckCircle2, ExternalLink, RefreshCw, Trash2, Archive } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { usePaymentLinks } from "@/hooks/use-payment-links";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface PaymentLinkCardProps {
  link: PaymentLink;
}

export function PaymentLinkCard({ link }: PaymentLinkCardProps) {
  const { deleteLink, renewLink, archiveLink } = usePaymentLinks();
  const { toast } = useToast();
  const [isRenewOpen, setIsRenewOpen] = useState(false);
  const [newUrl, setNewUrl] = useState("");

  const handleRenew = async () => {
    if (!newUrl) {
      toast({
        title: "错误",
        description: "请输入新的支付链接",
        variant: "destructive",
      });
      return;
    }

    try {
      await renewLink({ id: link.id, url: newUrl });
      setIsRenewOpen(false);
      setNewUrl("");
    } catch (error) {
      console.error('续期过程中出错:', error);
      toast({
        title: "错误",
        description: "更新支付链接失败，请重试",
        variant: "destructive",
      });
    }
  };

  const handleArchive = () => {
    archiveLink(link.id);
  };

  // 将金额从分转换为AED，保留2位小数
  const formattedAmount = (link.amount / 100).toFixed(2);

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-6">
        <div className="mb-4 flex justify-between items-center">
          <div className="flex gap-2 items-center">
            {link.status === "active" ? (
              <Badge className="bg-green-500">
                <CheckCircle2 className="w-4 h-4 mr-1" />
                已激活
              </Badge>
            ) : (
              <>
                <Badge variant="destructive">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  错误: {link.errorCode}
                </Badge>
                <Dialog open={isRenewOpen} onOpenChange={setIsRenewOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-primary hover:text-primary/90"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>更新支付链接</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <Input
                        placeholder="输入新的支付链接"
                        value={newUrl}
                        onChange={(e) => setNewUrl(e.target.value)}
                      />
                      <Button
                        className="w-full"
                        onClick={handleRenew}
                        disabled={!newUrl}
                      >
                        更新链接
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary"
              onClick={handleArchive}
            >
              <Archive className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive/90"
              onClick={() => deleteLink(link.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4">
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:opacity-80 transition-opacity"
          >
            <QRCodeSVG
              value={link.url}
              size={240}
              level="M"
              bgColor="#FFFFFF"
              fgColor="#000000"
              className="bg-white p-4 rounded-lg cursor-pointer"
              style={{
                shapeRendering: "crispEdges",
              }}
            />
          </a>

          <div className="text-center space-y-2">
            {link.transactionNo && (
              <p className="text-sm text-muted-foreground">
                交易号: {link.transactionNo}
              </p>
            )}
            <p className="text-2xl font-bold">
              {formattedAmount} AED
            </p>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center justify-center gap-1"
            >
              <span className="truncate max-w-[200px]">{link.url}</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}