import { useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { CleanComposer } from "@/components/composer/CleanComposer";
import { useMe } from "@/lib/queries";

export default function CreatePage() {
  const { data: me } = useMe();
  const [files, setFiles] = useState<File[]>([]);
  const firstName = me?.name?.split(" ")[0] ?? "there";

  const handlePickFiles = (picked: File[]) => {
    setFiles((prev) => [...prev, ...picked]);
    toast.success(`${picked.length} file${picked.length > 1 ? "s" : ""} added`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-2xl">
        <CleanComposer greeting={`Back at it, ${firstName}`} onPickFiles={handlePickFiles} />

        {files.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            {files.map((f, i) => (
              <div
                key={i}
                className="aspect-square bg-surface-2 border border-border rounded-lg flex flex-col items-center justify-center text-xs text-muted p-3"
              >
                <ImageIcon size={20} className="mb-2 opacity-50" />
                <span className="truncate w-full text-center">{f.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
