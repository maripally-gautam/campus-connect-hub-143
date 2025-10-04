import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card/95 group-[.toaster]:backdrop-blur-xl group-[.toaster]:text-foreground group-[.toaster]:border-2 group-[.toaster]:border-primary/30 group-[.toaster]:shadow-2xl group-[.toaster]:shadow-primary/20 group-[.toaster]:rounded-xl",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:shadow-[0_0_15px_rgba(79,143,255,0.5)] group-[.toast]:rounded-lg",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-lg",
          success: "group-[.toaster]:border-[hsl(150,80%,50%)]/50 group-[.toaster]:shadow-[hsl(150,80%,50%)]/20",
          error: "group-[.toaster]:border-destructive/50 group-[.toaster]:shadow-destructive/20",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
