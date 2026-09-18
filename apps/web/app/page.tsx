import { Hero } from "@/components/landing/hero";
import { ProductPreview } from "@/components/landing/product-preview";
import { ProtocolFlow } from "@/components/landing/protocol-flow";
import { SiteFooter } from "@/components/landing/site-footer";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <Hero />
      <ProtocolFlow />
      <ProductPreview />
      <SiteFooter />
    </div>
  );
}
