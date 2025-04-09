import { useState, useEffect } from "react";
import { usePaymentLinks } from "@/hooks/use-payment-links";
import { PaymentLinkCard } from "./payment-link-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowUpDown } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertPaymentLinkSchema } from "@shared/schema";
import type { InsertPaymentLink } from "@shared/schema";
import { DatePicker } from "@/components/ui/date-picker";
import { isWithinInterval, startOfDay, endOfDay } from "date-fns";

export function PaymentLinkGrid() {
  const { links, isLoading, createLink, checkStatus } = usePaymentLinks();
  const [sortByAmount, setSortByAmount] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined,
  });

  const form = useForm<InsertPaymentLink>({
    resolver: zodResolver(insertPaymentLinkSchema),
    defaultValues: {
      url: "",
      amount: 0,
    },
  });

  useEffect(() => {
    const interval = setInterval(() => {
      links.forEach((link) => {
        if (link && !link.archived) {
          checkStatus(link.id).catch((error) => {
            if (!error.message.includes('NOT_FOUND')) {
              console.error('检查状态错误:', error);
            }
          });
        }
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [links, checkStatus]);

  const sortedLinks = [...links].sort((a, b) => {
    if (!sortByAmount) return 0;
    return b.amount - a.amount;
  });

  const filteredArchivedLinks = sortedLinks.filter(link => {
    if (!link.archived) return false;
    if (!dateRange.from && !dateRange.to) return true;

    const linkDate = new Date(link.lastChecked);
    const start = dateRange.from ? startOfDay(dateRange.from) : undefined;
    const end = dateRange.to ? endOfDay(dateRange.to) : undefined;

    if (start && end) {
      return isWithinInterval(linkDate, { start, end });
    } else if (start) {
      return linkDate >= start;
    } else if (end) {
      return linkDate <= end;
    }
    return true;
  });

  const activeLinks = sortedLinks.filter(link => !link.archived);

  const onSubmit = (data: InsertPaymentLink) => {
    const amountInCents = Math.round(parseFloat(data.amount.toString()) * 100);
    if (isNaN(amountInCents) || amountInCents <= 0) {
      form.setError("amount", {
        type: "manual",
        message: "请输入有效的金额"
      });
      return;
    }

    createLink({
      ...data,
      amount: amountInCents
    });
    setIsOpen(false);
    form.reset();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>添加支付链接</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>创建新支付链接</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="url">支付链接</Label>
                <Input
                  id="url"
                  placeholder="https://..."
                  {...form.register("url")}
                />
                {form.formState.errors.url && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.url.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">金额 (AED)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  {...form.register("amount", {
                    valueAsNumber: true,
                    min: {
                      value: 0.01,
                      message: "金额必须大于0"
                    }
                  })}
                />
                {form.formState.errors.amount && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.amount.message}
                  </p>
                )}
              </div>
              <Button type="submit" className="w-full">
                创建链接
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        <Button
          variant="outline"
          onClick={() => setSortByAmount(!sortByAmount)}
        >
          <ArrowUpDown className="h-4 w-4 mr-2" />
          按金额排序
        </Button>
      </div>

      <Tabs defaultValue="active" className="space-y-6">
        <TabsList>
          <TabsTrigger value="active">活跃链接</TabsTrigger>
          <TabsTrigger value="archived">已归档链接</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {activeLinks.map((link) => (
              <PaymentLinkCard key={link.id} link={link} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="archived">
          <div className="mb-6 flex items-center gap-2">
            <div className="grid gap-2">
              <Label>日期范围</Label>
              <div className="flex gap-2">
                <DatePicker
                  selected={dateRange.from}
                  onSelect={(date) =>
                    setDateRange(prev => ({ ...prev, from: date }))
                  }
                  placeholderText="开始日期"
                />
                <DatePicker
                  selected={dateRange.to}
                  onSelect={(date) =>
                    setDateRange(prev => ({ ...prev, to: date }))
                  }
                  placeholderText="结束日期"
                />
              </div>
            </div>
            <Button
              variant="outline"
              className="mt-8"
              onClick={() => setDateRange({ from: undefined, to: undefined })}
            >
              清除筛选
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredArchivedLinks.map((link) => (
              <PaymentLinkCard key={link.id} link={link} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}