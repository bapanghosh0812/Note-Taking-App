import Link from "next/link";
import { SealMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <SealMark className="size-20 opacity-80 grayscale-[35%]" />
      <p className="text-gold mt-8 text-xs font-medium tracking-[0.25em] uppercase">404</p>
      <h1 className="font-display mt-2 text-5xl tracking-tight">Nothing behind this seal</h1>
      <p className="text-muted-foreground mt-3 max-w-sm text-sm">The page you’re looking for doesn’t exist or has been moved.</p>
      <Button asChild variant="gold" size="lg" className="mt-8">
        <Link href="/">Back to Cachet</Link>
      </Button>
    </div>
  );
}
