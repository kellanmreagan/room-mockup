import { RoomStudio } from "@/components/room-studio";
import { SampleCatalogSource } from "@/lib/product-source";

export default function HomePage() {
  const sampleItems = new SampleCatalogSource().listProducts();
  return <RoomStudio sampleItems={sampleItems} />;
}
