import HalamanUji from '@/components/HalamanUji';

// Kondisi SSR: route dirender pada setiap request pengguna.
export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <HalamanUji slug={slug} awalan="/ssr" />;
}
