import HalamanUji from '@/components/HalamanUji';
import { ambilDaftarSlug } from '@/lib/data';

// Kondisi SSG: seluruh slug diprarender saat build; slug lain menghasilkan 404.
export const dynamic = 'force-static';
export const dynamicParams = false;

export async function generateStaticParams() {
  const daftarSlug = await ambilDaftarSlug();
  return daftarSlug.map((slug) => ({ slug }));
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <HalamanUji slug={slug} awalan="/ssg" />;
}
