import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// ── TableSkeleton ──────────────────────────────────────────────────────────────
export function TableSkeleton({ rows = 6, cols = 5 }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="border-b border-border bg-muted/30 px-4 py-3 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="px-4 py-3 border-b border-border/50 last:border-0 flex gap-4 items-center"
        >
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              className={`h-4 ${c === 0 ? "w-[30%]" : c === cols - 1 ? "w-[60px]" : "flex-1"}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── CardSkeleton ───────────────────────────────────────────────────────────────
export function CardSkeleton({ count = 6, cols = "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" }) {
  return (
    <div className={`grid ${cols} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="border-border/60">
          <CardHeader className="space-y-2 pb-3">
            <div className="flex items-start justify-between gap-2">
              <Skeleton className="h-5 w-[55%]" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-3.5 w-[40%]" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-[80%]" />
            <Skeleton className="h-3.5 w-[60%]" />
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-7 w-16 rounded-md" />
              <Skeleton className="h-7 w-16 rounded-md" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── StatsSkeleton ──────────────────────────────────────────────────────────────
export function StatsSkeleton({ stats = 4, showChart = true }) {
  return (
    <div className="space-y-4">
      <div className={`grid grid-cols-2 ${stats <= 4 ? "md:grid-cols-4" : "md:grid-cols-3 lg:grid-cols-6"} gap-4`}>
        {Array.from({ length: stats }).map((_, i) => (
          <Card key={i} className="border-border/60">
            <CardContent className="pt-6 space-y-2">
              <Skeleton className="h-3 w-[55%]" />
              <Skeleton className="h-7 w-[70%]" />
              <Skeleton className="h-3 w-[40%]" />
            </CardContent>
          </Card>
        ))}
      </div>
      {showChart && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border-border/60">
            <CardHeader className="space-y-1.5">
              <Skeleton className="h-5 w-[40%]" />
              <Skeleton className="h-3.5 w-[30%]" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full rounded-lg" />
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardHeader className="space-y-1.5">
              <Skeleton className="h-5 w-[40%]" />
              <Skeleton className="h-3.5 w-[30%]" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full rounded-lg" />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ── KanbanSkeleton ─────────────────────────────────────────────────────────────
export function KanbanSkeleton({ columns = 4 }) {
  const heights = ["h-20", "h-28", "h-24", "h-16", "h-20"];
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {Array.from({ length: columns }).map((_, col) => (
        <div key={col} className="flex-1 min-w-[220px] space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-[60%]" />
            <Skeleton className="h-5 w-7 rounded-full" />
          </div>
          {Array.from({ length: 3 }).map((_, card) => (
            <Card key={card} className="border-border/60">
              <CardContent className="p-3 space-y-2">
                <Skeleton className={`w-full ${heights[(col * 3 + card) % heights.length]}`} />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-12 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── TimelineSkeleton ───────────────────────────────────────────────────────────
export function TimelineSkeleton({ years = 2, items = 4 }) {
  return (
    <div className="space-y-8">
      {Array.from({ length: years }).map((_, y) => (
        <div key={y}>
          <div className="flex items-center gap-3 mb-4">
            <Skeleton className="w-10 h-10 rounded-lg" />
            <div className="space-y-1">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-3 w-36" />
            </div>
          </div>
          <div className="relative pl-6 ml-5 border-l-2 border-border space-y-4">
            {Array.from({ length: items }).map((_, i) => (
              <div key={i} className="relative">
                <span className="absolute -left-[25px] top-3 w-3 h-3 rounded-full border-2 border-border bg-background" />
                <Card className="border-border/60">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <Skeleton className="h-4 w-[50%]" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                    <Skeleton className="h-3.5 w-[80%]" />
                    <Skeleton className="h-3.5 w-[60%]" />
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── ListSkeleton ───────────────────────────────────────────────────────────────
export function ListSkeleton({ count = 6 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="border-border/60">
          <CardContent className="p-4 flex items-start gap-3">
            <Skeleton className="w-9 h-9 rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-[40%]" />
                <Skeleton className="h-4 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3.5 w-[75%]" />
            </div>
            <Skeleton className="h-3.5 w-16 shrink-0" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── DetailSkeleton ─────────────────────────────────────────────────────────────
export function DetailSkeleton({ rows = 6 }) {
  return (
    <Card className="border-border/60">
      <CardHeader className="space-y-1.5">
        <Skeleton className="h-6 w-[45%]" />
        <Skeleton className="h-4 w-[30%]" />
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ── FormSkeleton ───────────────────────────────────────────────────────────────
export function FormSkeleton({ fields = 5 }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
      ))}
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-9 w-20 rounded-md" />
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>
    </div>
  );
}

// ── ProductGridSkeleton ────────────────────────────────────────────────────────
export function ProductGridSkeleton({ count = 8 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="border-border/60 overflow-hidden">
          <Skeleton className="w-full h-44 rounded-none" />
          <CardContent className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <Skeleton className="h-4 w-[60%]" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3.5 w-[70%]" />
            <div className="flex gap-1.5 pt-1">
              <Skeleton className="h-5 w-10 rounded-full" />
              <Skeleton className="h-5 w-10 rounded-full" />
              <Skeleton className="h-5 w-10 rounded-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── InventorySkeleton ──────────────────────────────────────────────────────────
export function InventorySkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="border-border/60">
            <CardContent className="p-4 space-y-1.5">
              <Skeleton className="h-3.5 w-[55%]" />
              <Skeleton className="h-7 w-[40%]" />
            </CardContent>
          </Card>
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, g) => (
        <Card key={g} className="border-border/60">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-[40%]" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, r) => (
                <div key={r} className="flex gap-4 items-center">
                  <Skeleton className="h-4 w-20" />
                  <div className="flex gap-2 flex-1">
                    {Array.from({ length: 4 }).map((_, c) => (
                      <Skeleton key={c} className="h-8 flex-1 rounded-md" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
