import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCouple, getCoupleSlugs } from "@/lib/config";
import { getTheme } from "@/lib/themes";

type Props = { params: Promise<{ slug: string }> };

// Couples are fixed at build time — unknown slugs 404 during export.
export const dynamicParams = false;

export function generateStaticParams() {
  return getCoupleSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const couple = getCouple(slug);
  if (!couple) return { title: "Wedding Invitation" };
  const { bride, groom } = couple.couple;
  const fallbackTitle = `${bride.fullName} & ${groom.fullName}`;
  const title = couple.seo?.title ?? fallbackTitle;
  const description = couple.seo?.description ?? couple.wedding.tagline;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: couple.seo?.ogImage ? [couple.seo.ogImage] : [],
    },
  };
}

export default async function WeddingPage({ params }: Props) {
  const { slug } = await params;
  const couple = getCouple(slug);
  if (!couple) notFound();
  const Theme = await getTheme(couple.theme);
  return <Theme couple={couple} />;
}
