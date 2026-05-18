import { cn } from "@/lib/utils";

const variantClasses = {
  card: "aspect-[4/3] w-full rounded-md",
  customerCard: "h-full min-h-[112px] w-full md:aspect-[4/3] md:h-auto md:min-h-0",
  categoryIcon: "h-8 w-8 shrink-0 rounded sm:h-9 sm:w-9",
  thumbnail: "h-10 w-10 shrink-0 rounded-md",
  picker: "aspect-[4/3] w-full rounded-md",
  demo: "h-32 w-full rounded-md sm:w-32"
};

type MenuImageProps = {
  src: string;
  alt?: string;
  variant?: keyof typeof variantClasses;
  className?: string;
  imageClassName?: string;
  onError?: () => void;
};

export function MenuImage({ src, alt = "", variant = "card", className, imageClassName, onError }: MenuImageProps) {
  return (
    <span className={cn("block overflow-hidden border bg-white", variantClasses[variant], className)}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className={cn("h-full w-full object-contain p-1.5", imageClassName)}
        onError={onError}
      />
    </span>
  );
}
