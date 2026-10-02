import React, { useEffect, useRef, useState } from "react";
import { Image as ImageIcon } from "lucide-react";
export default function NewsCover({ item, call }) {
  const ref = useRef(null),
    [image, setImage] = useState("");
  useEffect(() => {
    setImage("");
    if (!item.imageURL) return;
    let active = true;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((x) => x.isIntersecting)) return;
        observer.disconnect();
        call("news.image", { id: item.id })
          .then((result) => {
            if (active && /^data:image\/jpeg;base64,/.test(result?.image || ""))
              setImage(result.image);
          })
          .catch(() => {});
      },
      { rootMargin: "80px" },
    );
    observer.observe(ref.current);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [item.id, item.imageURL, call]);
  return (
    <button
      ref={ref}
      className={`news-cover ${image ? "has-cover" : ""}`}
      aria-label={`查看${item.title}原文`}
      onClick={() => call("news.open", { url: item.url }).catch(() => {})}
    >
      {image ? (
        <img
          src={image}
          alt={`${item.title}封面`}
          onError={() => setImage("")}
        />
      ) : (
        <>
          <ImageIcon size={24} aria-hidden="true" />
          <span>{item.source}</span>
        </>
      )}
    </button>
  );
}
