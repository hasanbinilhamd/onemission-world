"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DEFAULT_LIMIT = 20;

const reviewApi = {
  async list({ page, limit, search, productId, rating, status, dateFrom, dateTo }) {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      search,
      productId,
      rating,
      status,
      dateFrom,
      dateTo,
    });
    const response = await fetch(`/api/admin/product-reviews?${params.toString()}`);
    return response.json();
  },
  async getById(id) {
    const response = await fetch(`/api/admin/product-reviews/${id}`);
    return response.json();
  },
  async publish(id) {
    const response = await fetch(`/api/admin/product-reviews/${id}/publish`, { method: "PATCH" });
    return response.json();
  },
  async hide(id) {
    const response = await fetch(`/api/admin/product-reviews/${id}/hide`, { method: "PATCH" });
    return response.json();
  },
  async remove(id) {
    const response = await fetch(`/api/admin/product-reviews/${id}`, { method: "DELETE" });
    return response.json();
  },
  async listProducts() {
    const response = await fetch("/api/admin/product-reviews/products");
    return response.json();
  },
};

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("id-ID", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusBadge(isPublished) {
  return isPublished
    ? <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10">Published</Badge>
    : <Badge variant="outline" className="border-amber-500/40 text-amber-700">Hidden</Badge>;
}

function ratingStars(value) {
  const rating = Number(value || 0);
  return (
    <div className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className={`h-3.5 w-3.5 ${index < rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

function ProductReviewDetailDialog({ open, onOpenChange, review, onPublish, onHide, onDelete, saving = false }) {
  if (!review) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{review.productName || "Product Review"}</DialogTitle>
          <DialogDescription>
            Review moderation and customer feedback detail.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Review Detail</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Product</span><span className="font-medium text-right">{review.productName || "—"}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Customer</span><span className="font-medium text-right">{review.customerName || "—"}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Order Number</span><span className="font-mono text-right">{review.orderNumber || "—"}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Rating</span><span className="flex items-center gap-2">{ratingStars(review.rating)}<span className="font-medium">{review.rating}</span></span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Status</span><span>{statusBadge(review.isPublished)}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Created At</span><span className="font-medium text-right">{formatDateTime(review.createdAt)}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Updated At</span><span className="font-medium text-right">{formatDateTime(review.updatedAt)}</span></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Customer Feedback</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Title</p>
                <p className="font-medium">{review.title || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Comment</p>
                <p className="whitespace-pre-wrap leading-6 text-foreground">{review.comment || "—"}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="mt-2 gap-2 sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {review.isPublished ? (
              <Button variant="outline" className="gap-2" onClick={onHide} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <EyeOff className="h-4 w-4" />} Hide
              </Button>
            ) : (
              <Button variant="outline" className="gap-2" onClick={onPublish} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Publish
              </Button>
            )}
            <Button variant="destructive" className="gap-2" onClick={onDelete} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete
            </Button>
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProductReviewsModule() {
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: DEFAULT_LIMIT, totalItems: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [productId, setProductId] = useState("all");
  const [rating, setRating] = useState("all");
  const [status, setStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [detailReview, setDetailReview] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [result, productsResult] = await Promise.all([
      reviewApi.list({
        page,
        limit: DEFAULT_LIMIT,
        search,
        productId: productId === "all" ? "" : productId,
        rating: rating === "all" ? "" : rating,
        status,
        dateFrom,
        dateTo,
      }),
      reviewApi.listProducts(),
    ]);

    if (result?.error) {
      toast.error(result.error);
      setItems([]);
      setPagination({ page: 1, limit: DEFAULT_LIMIT, totalItems: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false });
      setLoading(false);
      return;
    }

    setItems(Array.isArray(result?.data) ? result.data : []);
    setPagination(result?.pagination || { page: 1, limit: DEFAULT_LIMIT, totalItems: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false });
    setProducts(Array.isArray(productsResult) ? productsResult : []);
    setLoading(false);
  }, [dateFrom, dateTo, page, productId, rating, search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, productId, rating, status, dateFrom, dateTo]);

  const openDetail = async (reviewId) => {
    const result = await reviewApi.getById(reviewId);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    setDetailReview(result);
    setShowDetail(true);
  };

  const handlePublish = async () => {
    if (!detailReview?.id) return;
    setSaving(true);
    try {
      const result = await reviewApi.publish(detailReview.id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Review published.");
      setDetailReview(result);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleHide = async () => {
    if (!detailReview?.id) return;
    setSaving(true);
    try {
      const result = await reviewApi.hide(detailReview.id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Review hidden.");
      setDetailReview(result);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!detailReview?.id) return;
    setSaving(true);
    try {
      const result = await reviewApi.remove(detailReview.id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Review deleted.");
      setShowDetail(false);
      setDetailReview(null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const activeProductOptions = useMemo(() => (
    Array.isArray(products) ? products : []
  ), [products]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[1.5rem] font-bold tracking-[0.04em] uppercase text-[#111827] leading-tight">Product Reviews</h2>
        <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">Moderate customer ratings and review visibility for product social proof.</p>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 items-end">
            <div className="lg:col-span-2">
              <Label>Search</Label>
              <div className="relative mt-1.5">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product, customer, review, or order number…" />
              </div>
            </div>
            <div>
              <Label>Product</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  {activeProductOptions.map((product) => (
                    <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Rating</Label>
              <Select value={rating} onValueChange={setRating}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Ratings</SelectItem>
                  {[5, 4, 3, 2, 1].map((value) => (
                    <SelectItem key={value} value={String(value)}>{value} Star{value === 1 ? '' : 's'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="hidden">Hidden</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date From</Label>
              <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label>Date To</Label>
              <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="mt-1.5" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading reviews…</div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center">
              <Star className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No reviews found</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Verified customer reviews will appear here after submission.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[rgba(17,24,39,0.04)]">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Product</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Customer</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Rating</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Review</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Order Number</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Created At</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.id} className={`border-b border-border/30 hover:bg-[#F7F8FA]/80 transition-colors ${index % 2 === 0 ? "" : "bg-muted/10"}`}>
                      <td className="px-4 py-3 font-medium">{item.productName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.customerName}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {ratingStars(item.rating)}
                          <span className="text-xs text-muted-foreground">{item.rating}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="max-w-[360px]">
                          {item.title ? <p className="font-medium truncate">{item.title}</p> : null}
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{item.comment}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.orderNumber || "—"}</td>
                      <td className="px-4 py-3">{statusBadge(item.isPublished)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDateTime(item.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => openDetail(item.id)}>
                          <Eye className="h-3.5 w-3.5" /> View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Showing page {pagination.page} of {pagination.totalPages} — {pagination.totalItems} total reviews
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" disabled={!pagination.hasPreviousPage} onClick={() => setPage((current) => Math.max(1, current - 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" disabled={!pagination.hasNextPage} onClick={() => setPage((current) => current + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ProductReviewDetailDialog
        open={showDetail}
        onOpenChange={setShowDetail}
        review={detailReview}
        onPublish={handlePublish}
        onHide={handleHide}
        onDelete={handleDelete}
        saving={saving}
      />
    </div>
  );
}
