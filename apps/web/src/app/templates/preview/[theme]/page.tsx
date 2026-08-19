import TemplatePreview from "@/components/buyer/TemplatePreview";

export const metadata = {
  title: "Template Preview",
};

// Static export requires known dynamic segments — our three themes.
export function generateStaticParams() {
  return [{ theme: "refined" }, { theme: "minimal" }, { theme: "vibrant" }];
}

export default function TemplatePreviewPage() {
  return <TemplatePreview />;
}
