import { useEffect } from "react";

interface SeoProps {
  title: string;
  description: string;
  image?: string;
}

export function useSeo({ title, description, image }: SeoProps) {
  useEffect(() => {
    document.title = `${title} | RestoSmart`;
    const setMeta = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement
             ?? document.querySelector(`meta[property="${name}"]`) as HTMLMetaElement;
      if (!el) { el = document.createElement("meta"); document.head.appendChild(el); }
      el.setAttribute(name.startsWith("og:") ? "property" : "name", name);
      el.content = content;
    };
    setMeta("description", description);
    setMeta("og:title", title);
    setMeta("og:description", description);
    if (image) setMeta("og:image", image);
    setMeta("og:type", "website");
  }, [title, description, image]);
}
